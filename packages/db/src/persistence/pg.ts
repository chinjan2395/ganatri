/**
 * PgPersistence — Postgres-backed `GamePersistence` (Drizzle query builder).
 *
 * Constructor takes an injected Drizzle database so tests can pass a
 * pglite-backed instance and production passes `getDb()`. Multi-row writes go
 * through `db.transaction`; upserts use `onConflictDoUpdate` /
 * `onConflictDoNothing`.
 */

import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { Database } from '../db';
import {
  authSessions,
  games,
  gameEvents,
  gamePlayers,
  oauthAccounts,
  playerProgression,
  playerStats,
  rooms,
  scoreLedger,
  userBlocks,
  users,
} from '../schema';
import type {
  AdminKpiStats,
  AdminUserStats,
  ApplyGameScoringInput,
  AppendEventInput,
  AuthSessionRow,
  BlockedUserEntry,
  CoPlayerEntry,
  CreateAuthSessionInput,
  ExportGameRow,
  FinalPlayerResult,
  GameEventRow,
  GameHistoryEntry,
  GameHistoryPlayer,
  GamePersistence,
  GamePlayerRow,
  PlayerProgression,
  GameRow,
  GameWithPlayers,
  LeaderboardEntry,
  NewUser,
  PlayerStatsDelta,
  PlayerProgressionRow,
  PlayerStatsRow,
  RankedLeaderboardEntry,
  RecordGameFinishedInput,
  RecordGameStartedInput,
  ResolvedAuthSession,
  RoomRow,
  RoomStatus,
  ScoreHistoryEntry,
  ScoreLedgerEntry,
  ScoreLedgerKind,
  ScoreLedgerReason,
  ScoredGamePlayerResult,
  UpsertOAuthUserInput,
  UserRow,
  UserSearchResult,
} from './types';

export class PgPersistence implements GamePersistence {
  constructor(private readonly db: Database) {}

  // Users -------------------------------------------------------------------

  async upsertUser(user: NewUser & { id: string }): Promise<UserRow> {
    const rows = await this.db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: user.displayName,
          email: user.email ?? null,
          // Only overwrite isGuest when explicitly provided; otherwise keep the
          // existing value so an omitted flag never flips a registered user back
          // to guest. Mirrors MemoryPersistence semantics.
          isGuest:
            user.isGuest !== undefined ? user.isGuest : sql`${users.isGuest}`,
          lastSeenAt: new Date(),
        },
      })
      .returning();
    return rows[0]!;
  }

  async ensureGuest(id: string, displayName: string): Promise<UserRow> {
    const rows = await this.db
      .insert(users)
      .values({ id, displayName, isGuest: true })
      .onConflictDoUpdate({
        target: users.id,
        set: { lastSeenAt: new Date() },
      })
      .returning();
    return rows[0]!;
  }

  async updateUserDisplayName(userId: string, newDisplayName: string): Promise<void> {
    await this.db
      .update(users)
      .set({ displayName: newDisplayName })
      .where(eq(users.id, userId));
  }

  async updateUserAvatarUrl(userId: string, avatarUrl: string | null): Promise<void> {
    await this.db
      .update(users)
      .set({ avatarUrl })
      .where(eq(users.id, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Anonymize historical game_players rows.
      await tx
        .update(gamePlayers)
        .set({ userId: null })
        .where(eq(gamePlayers.userId, userId));

      // 2. Anonymize game_events actor references.
      await tx
        .update(gameEvents)
        .set({ actorUserId: null })
        .where(eq(gameEvents.actorUserId, userId));

      // 3. Nullify games.winner_id references.
      await tx
        .update(games)
        .set({ winnerId: null })
        .where(eq(games.winnerId, userId));

      // 4. Nullify rooms.host_user_id references.
      await tx
        .update(rooms)
        .set({ hostUserId: null })
        .where(eq(rooms.hostUserId, userId));

      // 5. Delete aggregate stats row.
      await tx
        .delete(playerStats)
        .where(eq(playerStats.userId, userId));

      // 6. Delete all auth sessions.
      await tx
        .delete(authSessions)
        .where(eq(authSessions.userId, userId));

      // 7. Delete OAuth account links.
      await tx
        .delete(oauthAccounts)
        .where(eq(oauthAccounts.userId, userId));

      // 8. Delete user block rows (both sides).
      await tx
        .delete(userBlocks)
        .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));

      // 9. Delete the user row itself.
      await tx
        .delete(users)
        .where(eq(users.id, userId));
    });
  }

  // Auth (OAuth + sessions) -------------------------------------------------

  async upsertOAuthUser(input: UpsertOAuthUserInput): Promise<{ user: UserRow; isNew: boolean }> {
    return this.db.transaction(async (tx) => {
      // (a) Existing federated identity -> return (and refresh) its user.
      const accountRows = await tx
        .select()
        .from(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.provider, input.provider),
            eq(oauthAccounts.providerUserId, input.providerUserId)
          )
        )
        .limit(1);
      const account = accountRows[0];
      if (account) {
        const updated = await tx
          .update(users)
          .set({
            displayName: input.displayName,
            avatarUrl: input.avatarUrl ?? null,
            lastSeenAt: new Date(),
          })
          .where(eq(users.id, account.userId))
          .returning();
        return { user: updated[0]!, isNew: false };
      }

      // (b) Match an existing user by email -> link a new account to it.
      if (input.email !== null) {
        const byEmail = await tx
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        const existing = byEmail[0];
        if (existing) {
          await tx.insert(oauthAccounts).values({
            userId: existing.id,
            provider: input.provider,
            providerUserId: input.providerUserId,
          });
          const updated = await tx
            .update(users)
            .set({
              displayName: input.displayName,
              avatarUrl: input.avatarUrl ?? null,
              isGuest: false,
              lastSeenAt: new Date(),
            })
            .where(eq(users.id, existing.id))
            .returning();
          return { user: updated[0]!, isNew: false };
        }
      }

      // (c) Create a fresh (non-guest) user + linked account.
      const created = await tx
        .insert(users)
        .values({
          displayName: input.displayName,
          email: input.email,
          avatarUrl: input.avatarUrl ?? null,
          isGuest: false,
        })
        .returning();
      const user = created[0]!;
      await tx.insert(oauthAccounts).values({
        userId: user.id,
        provider: input.provider,
        providerUserId: input.providerUserId,
      });
      return { user, isNew: true };
    });
  }

  async createAuthSession(input: CreateAuthSessionInput): Promise<AuthSessionRow> {
    const rows = await this.db.insert(authSessions).values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
    }).returning();
    return rows[0]!;
  }

  async getAuthSessionByTokenHash(tokenHash: string): Promise<ResolvedAuthSession | null> {
    const rows = await this.db
      .select({ session: authSessions, user: users })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          eq(authSessions.revoked, false),
          sql`${authSessions.expiresAt} > now()`
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async touchAuthSession(tokenHash: string, expiresAt: Date): Promise<AuthSessionRow | null> {
    const rows = await this.db
      .update(authSessions)
      .set({
        lastSeenAt: new Date(),
        expiresAt,
      })
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          eq(authSessions.revoked, false),
          sql`${authSessions.expiresAt} > now()`
        )
      )
      .returning();
    return rows[0] ?? null;
  }

  async listAuthSessions(userId: string): Promise<AuthSessionRow[]> {
    return this.db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          eq(authSessions.revoked, false),
          sql`${authSessions.expiresAt} > now()`
        )
      )
      .orderBy(desc(authSessions.lastSeenAt), desc(authSessions.createdAt));
  }

  async revokeAuthSession(tokenHash: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revoked: true })
      .where(eq(authSessions.tokenHash, tokenHash));
  }

  async revokeAuthSessionById(userId: string, sessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revoked: true })
      .where(
        and(
          eq(authSessions.userId, userId),
          eq(authSessions.id, sessionId),
          eq(authSessions.revoked, false),
          sql`${authSessions.expiresAt} > now()`
        )
      );
  }

  async revokeOtherAuthSessions(userId: string, currentSessionId: string): Promise<number> {
    const revoked = await this.db
      .update(authSessions)
      .set({ revoked: true })
      .where(
        and(
          eq(authSessions.userId, userId),
          eq(authSessions.revoked, false),
          sql`${authSessions.expiresAt} > now()`,
          sql`${authSessions.id} <> ${currentSessionId}`
        )
      )
      .returning({ id: authSessions.id });
    return revoked.length;
  }

  // History -----------------------------------------------------------------

  async getUserGameHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<GameHistoryEntry[]> {
    // Games this user played, newest first.
    const rows = await this.db
      .select({ game: games })
      .from(gamePlayers)
      .innerJoin(games, eq(gamePlayers.gameId, games.id))
      .where(eq(gamePlayers.userId, userId))
      .orderBy(desc(games.startedAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) return [];

    const gameIds = rows.map((r) => r.game.id);
    const allPlayers = await this.db
      .select()
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, gameIds))
      .orderBy(asc(gamePlayers.seatIndex));

    const byGame = new Map<string, GamePlayerRow[]>();
    for (const p of allPlayers) {
      const list = byGame.get(p.gameId);
      if (list) list.push(p);
      else byGame.set(p.gameId, [p]);
    }

    return rows.map(({ game }) => toHistoryEntry(game, byGame.get(game.id) ?? [], userId));
  }

  // Retention ---------------------------------------------------------------

  async pruneGameEventsBefore(cutoff: Date): Promise<number> {
    const deleted = await this.db
      .delete(gameEvents)
      .where(lt(gameEvents.ts, cutoff))
      .returning({ id: gameEvents.id });
    return deleted.length;
  }

  async pruneAbandonedGamesBefore(cutoff: Date): Promise<number> {
    return this.db.transaction(async (tx) => {
      const target = await tx
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.isAbandoned, true), lt(games.endedAt, cutoff)));
      const ids = target.map((g) => g.id);
      if (ids.length === 0) return 0;

      await tx.delete(gameEvents).where(inArray(gameEvents.gameId, ids));
      await tx.delete(gamePlayers).where(inArray(gamePlayers.gameId, ids));
      const deleted = await tx
        .delete(games)
        .where(inArray(games.id, ids))
        .returning({ id: games.id });
      return deleted.length;
    });
  }

  // Rooms -------------------------------------------------------------------

  async recordRoomCreated(input: {
    roomCode: string;
    hostUserId: string;
    configSnapshot?: unknown;
    status?: RoomStatus;
  }): Promise<RoomRow> {
    const rows = await this.db
      .insert(rooms)
      .values({
        roomCode: input.roomCode,
        hostUserId: input.hostUserId,
        configSnapshot: input.configSnapshot ?? null,
        status: input.status ?? 'LOBBY',
      })
      .returning();
    return rows[0]!;
  }

  async updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    closedAt?: Date | null
  ): Promise<RoomRow | null> {
    const set: Partial<RoomRow> = { status };
    if (closedAt !== undefined) set.closedAt = closedAt;
    const rows = await this.db
      .update(rooms)
      .set(set)
      .where(eq(rooms.id, roomId))
      .returning();
    return rows[0] ?? null;
  }

  // Games -------------------------------------------------------------------

  async recordGameStarted(input: RecordGameStartedInput): Promise<GameRow> {
    const rows = await this.db
      .insert(games)
      .values({
        roomId: input.roomId,
        seed: String(input.seed),
        seatingOrder: [...input.seatingOrder],
        playerCount: input.playerCount ?? input.seatingOrder.length,
        configSnapshot: input.configSnapshot ?? null,
        startedAt: input.startedAt ?? new Date(),
      })
      .returning();
    return rows[0]!;
  }

  async recordGameFinished(
    input: RecordGameFinishedInput
  ): Promise<GameWithPlayers> {
    return this.db.transaction(async (tx) => {
      const gameRows = await tx
        .update(games)
        .set({
          endedAt: input.endedAt ?? new Date(),
          durationMs: input.durationMs ?? null,
          winnerId: input.winnerId ?? null,
          isAbandoned: input.isAbandoned ?? false,
        })
        .where(eq(games.id, input.gameId))
        .returning();
      const game = gameRows[0];
      if (!game) {
        throw new Error(`recordGameFinished: game ${input.gameId} not found`);
      }

      let players: GamePlayerRow[] = [];
      if (input.players.length > 0) {
        // Idempotent against the (game_id, seat_index) unique index: a retry or
        // double GAME_OVER updates the existing row in place instead of
        // inserting a duplicate set of game_players rows.
        players = await tx
          .insert(gamePlayers)
          .values(
            input.players.map((p: FinalPlayerResult) => ({
              gameId: input.gameId,
              userId: p.userId,
              seatIndex: p.seatIndex,
              displayNameSnapshot: p.displayName,
              finalRank: p.finalRank,
              wasCut: p.wasCut,
              captureCount: p.captureCount,
              result: p.result,
            }))
          )
          .onConflictDoUpdate({
            target: [gamePlayers.gameId, gamePlayers.seatIndex],
            set: {
              userId: sql`excluded.user_id`,
              displayNameSnapshot: sql`excluded.display_name_snapshot`,
              finalRank: sql`excluded.final_rank`,
              wasCut: sql`excluded.was_cut`,
              captureCount: sql`excluded.capture_count`,
              result: sql`excluded.result`,
            },
          })
          .returning();
      }
      return { game, players };
    });
  }

  // Events ------------------------------------------------------------------

  async appendGameEvent(input: AppendEventInput): Promise<GameEventRow> {
    const rows = await this.db
      .insert(gameEvents)
      .values({
        gameId: input.gameId,
        seq: input.seq,
        ts: input.ts ?? new Date(),
        actorUserId: input.actorUserId ?? null,
        eventType: input.eventType,
        payload: input.payload,
      })
      .returning();
    return rows[0]!;
  }

  async appendGameEvents(
    events: readonly AppendEventInput[]
  ): Promise<GameEventRow[]> {
    if (events.length === 0) return [];
    return this.db.transaction(async (tx) => {
      return tx
        .insert(gameEvents)
        .values(
          events.map((e) => ({
            gameId: e.gameId,
            seq: e.seq,
            ts: e.ts ?? new Date(),
            actorUserId: e.actorUserId ?? null,
            eventType: e.eventType,
            payload: e.payload,
          }))
        )
        .returning();
    });
  }

  // Stats -------------------------------------------------------------------

  async upsertPlayerStats(delta: PlayerStatsDelta): Promise<PlayerStatsRow> {
    const inc = (n?: number) => n ?? 0;
    const rows = await this.db
      .insert(playerStats)
      .values({
        userId: delta.userId,
        gamesPlayed: inc(delta.gamesPlayed),
        gamesWon: inc(delta.gamesWon),
        gamesLost: inc(delta.gamesLost),
        gamesAbandoned: inc(delta.gamesAbandoned),
        totalCaptures: inc(delta.totalCaptures),
        cutsGiven: inc(delta.cutsGiven),
        cutsReceived: inc(delta.cutsReceived),
        timesSafe: inc(delta.timesSafe),
        totalPlayTimeMs: inc(delta.totalPlayTimeMs),
        longestWinStreak: delta.longestWinStreak ?? 0,
        currentWinStreak: delta.currentWinStreak ?? 0,
        sumFinishPositions: inc(delta.sumFinishPositions),
        highestMatchScore: delta.highestMatchScore ?? 0,
        totalMatchScore: inc(delta.totalMatchScore),
        ghostFinishes: inc(delta.ghostFinishes),
      })
      .onConflictDoUpdate({
        target: playerStats.userId,
        set: {
          gamesPlayed: sql`${playerStats.gamesPlayed} + ${inc(delta.gamesPlayed)}`,
          gamesWon: sql`${playerStats.gamesWon} + ${inc(delta.gamesWon)}`,
          gamesLost: sql`${playerStats.gamesLost} + ${inc(delta.gamesLost)}`,
          gamesAbandoned: sql`${playerStats.gamesAbandoned} + ${inc(delta.gamesAbandoned)}`,
          totalCaptures: sql`${playerStats.totalCaptures} + ${inc(delta.totalCaptures)}`,
          cutsGiven: sql`${playerStats.cutsGiven} + ${inc(delta.cutsGiven)}`,
          cutsReceived: sql`${playerStats.cutsReceived} + ${inc(delta.cutsReceived)}`,
          timesSafe: sql`${playerStats.timesSafe} + ${inc(delta.timesSafe)}`,
          totalPlayTimeMs: sql`${playerStats.totalPlayTimeMs} + ${inc(delta.totalPlayTimeMs)}`,
          longestWinStreak:
            delta.longestWinStreak !== undefined
              ? delta.longestWinStreak
              : sql`${playerStats.longestWinStreak}`,
          currentWinStreak:
            delta.currentWinStreak !== undefined
              ? delta.currentWinStreak
              : sql`${playerStats.currentWinStreak}`,
          sumFinishPositions: sql`${playerStats.sumFinishPositions} + ${inc(delta.sumFinishPositions)}`,
          highestMatchScore:
            delta.highestMatchScore !== undefined
              ? sql`greatest(${playerStats.highestMatchScore}, ${delta.highestMatchScore})`
              : sql`${playerStats.highestMatchScore}`,
          totalMatchScore: sql`${playerStats.totalMatchScore} + ${inc(delta.totalMatchScore)}`,
          ghostFinishes: sql`${playerStats.ghostFinishes} + ${inc(delta.ghostFinishes)}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0]!;
  }

  async getPlayerStats(userId: string): Promise<PlayerStatsRow | null> {
    const rows = await this.db
      .select()
      .from(playerStats)
      .where(eq(playerStats.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getPlayerProgression(userId: string): Promise<PlayerProgression | null> {
    const rows = await this.db
      .select()
      .from(playerProgression)
      .where(eq(playerProgression.userId, userId))
      .limit(1);
    return rows[0] ? toPlayerProgression(rows[0]) : null;
  }

  async getScoreHistory(userId: string, limit = 20, offset = 0): Promise<ScoreHistoryEntry[]> {
    const gameRows = await this.db
      .select({
        gameId: gamePlayers.gameId,
        createdAt: games.endedAt,
        matchScore: gamePlayers.matchScore,
        xpEarned: gamePlayers.xpEarned,
        rankedRatingDelta: gamePlayers.rankedRatingDelta,
      })
      .from(gamePlayers)
      .innerJoin(games, eq(gamePlayers.gameId, games.id))
      .where(eq(gamePlayers.userId, userId))
      .orderBy(desc(games.endedAt), desc(games.startedAt))
      .limit(limit)
      .offset(offset);

    if (gameRows.length === 0) return [];

    const gameIds = gameRows.map((row) => row.gameId);
    const ledgerRows = await this.db
      .select()
      .from(scoreLedger)
      .where(and(eq(scoreLedger.userId, userId), inArray(scoreLedger.gameId, gameIds)))
      .orderBy(desc(scoreLedger.createdAt), asc(scoreLedger.kind), asc(scoreLedger.reason));

    const byGame = new Map<string, ScoreLedgerEntry[]>();
    for (const row of ledgerRows) {
      const entries = byGame.get(row.gameId);
      const entry = toScoreLedgerEntry(row);
      if (entries) entries.push(entry);
      else byGame.set(row.gameId, [entry]);
    }

    return gameRows.map((row) => ({
      gameId: row.gameId,
      createdAt: row.createdAt ?? new Date(0),
      matchScore: row.matchScore ?? 0,
      xpEarned: row.xpEarned ?? 0,
      rankedRatingDelta: row.rankedRatingDelta ?? 0,
      rows: byGame.get(row.gameId) ?? [],
    }));
  }

  async applyGameScoring(input: ApplyGameScoringInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existingLedger = await tx
        .select({ id: scoreLedger.id })
        .from(scoreLedger)
        .where(eq(scoreLedger.gameId, input.gameId))
        .limit(1);
      if (existingLedger.length > 0) return;

      // Batch containers — filled during the loop, flushed after.
      const progressionValues: Array<{
        userId: string;
        rankedRating: number;
        totalXp: number;
        level: number;
        highestMatchScore: number;
        totalMatchScore: number;
        ghostFinishes: number;
        updatedAt: Date;
      }> = [];
      const allLedgerRows: ReturnType<typeof toLedgerRows> = [];

      for (const player of input.scoredPlayers) {
        // Per-player UPDATE kept serial: each row has different values and a
        // CASE WHEN batch expression would add complexity for only 2–4 rows.
        await tx
          .update(gamePlayers)
          .set({
            matchScore: player.matchScore,
            xpEarned: player.xpEarned,
            rankedRatingDelta: player.rankedRatingDelta,
          })
          .where(and(eq(gamePlayers.gameId, input.gameId), eq(gamePlayers.seatIndex, player.seatIndex)));

        if (player.userId === null || player.progressionAfter === null) {
          continue;
        }

        // Collect for batch upsert below.
        progressionValues.push({
          userId: player.userId,
          rankedRating: player.progressionAfter.rankedRating,
          totalXp: player.progressionAfter.totalXp,
          level: player.progressionAfter.level,
          highestMatchScore: player.progressionAfter.highestMatchScore,
          totalMatchScore: player.progressionAfter.totalMatchScore,
          ghostFinishes: player.progressionAfter.ghostFinishes,
          updatedAt: player.progressionAfter.updatedAt,
        });

        // Collect for batch insert below.
        allLedgerRows.push(...toLedgerRows(input.gameId, player));
      }

      // Single batch upsert for all player_progression rows.
      if (progressionValues.length > 0) {
        await tx
          .insert(playerProgression)
          .values(progressionValues)
          .onConflictDoUpdate({
            target: playerProgression.userId,
            set: {
              rankedRating: sql`excluded.ranked_rating`,
              totalXp: sql`excluded.total_xp`,
              level: sql`excluded.level`,
              highestMatchScore: sql`excluded.highest_match_score`,
              totalMatchScore: sql`excluded.total_match_score`,
              ghostFinishes: sql`excluded.ghost_finishes`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      // Single batch insert for all score_ledger rows.
      if (allLedgerRows.length > 0) {
        await tx.insert(scoreLedger).values(allLedgerRows);
      }
    });
  }

  async mergeGuestIntoUser(guestUserId: string, registeredUserId: string): Promise<void> {
    if (guestUserId === registeredUserId) return;
    // Validate that guestUserId looks like a UUID before hitting the DB.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(guestUserId)) return;
    await this.db.transaction(async (tx) => {
      // Only merge actual guests
      const guestRows = await tx.select().from(users).where(eq(users.id, guestUserId)).limit(1);
      const guest = guestRows[0];
      if (!guest || !guest.isGuest) return;

      // Re-point all game_players from guest to registered
      await tx.update(gamePlayers).set({ userId: registeredUserId }).where(eq(gamePlayers.userId, guestUserId));

      // Nullify games.winner_id where it still points to the guest
      // (The guest won games — re-point the winner to registered user)
      await tx.update(games).set({ winnerId: registeredUserId }).where(eq(games.winnerId, guestUserId));

      // Nullify game_events.actor_user_id where it points to the guest
      await tx.update(gameEvents).set({ actorUserId: registeredUserId }).where(eq(gameEvents.actorUserId, guestUserId));

      // Re-point rooms.host_user_id where guest is the host
      await tx.update(rooms).set({ hostUserId: registeredUserId }).where(eq(rooms.hostUserId, guestUserId));

      // Merge player_stats
      const [guestStats] = await tx.select().from(playerStats).where(eq(playerStats.userId, guestUserId)).limit(1);
      if (guestStats) {
        const [regStats] = await tx.select().from(playerStats).where(eq(playerStats.userId, registeredUserId)).limit(1);
        const mergedLongest = regStats ? Math.max(regStats.longestWinStreak, guestStats.longestWinStreak) : guestStats.longestWinStreak;
        const mergedCurrent = regStats ? Math.max(regStats.currentWinStreak, guestStats.currentWinStreak) : guestStats.currentWinStreak;

        if (!regStats) {
          await tx.insert(playerStats).values({
            userId: registeredUserId,
            gamesPlayed: guestStats.gamesPlayed,
            gamesWon: guestStats.gamesWon,
            gamesLost: guestStats.gamesLost,
            gamesAbandoned: guestStats.gamesAbandoned,
            totalCaptures: guestStats.totalCaptures,
            cutsGiven: guestStats.cutsGiven,
            cutsReceived: guestStats.cutsReceived,
            timesSafe: guestStats.timesSafe,
            totalPlayTimeMs: guestStats.totalPlayTimeMs,
            longestWinStreak: mergedLongest,
            currentWinStreak: mergedCurrent,
            sumFinishPositions: guestStats.sumFinishPositions,
          });
        } else {
          await tx.update(playerStats)
            .set({
              gamesPlayed: sql`${playerStats.gamesPlayed} + ${guestStats.gamesPlayed}`,
              gamesWon: sql`${playerStats.gamesWon} + ${guestStats.gamesWon}`,
              gamesLost: sql`${playerStats.gamesLost} + ${guestStats.gamesLost}`,
              gamesAbandoned: sql`${playerStats.gamesAbandoned} + ${guestStats.gamesAbandoned}`,
              totalCaptures: sql`${playerStats.totalCaptures} + ${guestStats.totalCaptures}`,
              cutsGiven: sql`${playerStats.cutsGiven} + ${guestStats.cutsGiven}`,
              cutsReceived: sql`${playerStats.cutsReceived} + ${guestStats.cutsReceived}`,
              timesSafe: sql`${playerStats.timesSafe} + ${guestStats.timesSafe}`,
              totalPlayTimeMs: sql`${playerStats.totalPlayTimeMs} + ${guestStats.totalPlayTimeMs}`,
              longestWinStreak: mergedLongest,
              currentWinStreak: mergedCurrent,
              sumFinishPositions: sql`${playerStats.sumFinishPositions} + ${guestStats.sumFinishPositions}`,
              updatedAt: new Date(),
            })
            .where(eq(playerStats.userId, registeredUserId));
        }

        await tx.delete(playerStats).where(eq(playerStats.userId, guestUserId));
      }

      // Clean up any auth rows for the guest before deleting the user row
      // (guests never have auth sessions in practice, but guard against FK violations)
      await tx.delete(authSessions).where(eq(authSessions.userId, guestUserId));
      await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, guestUserId));

      // Delete the guest user row (all FK refs have been re-pointed above)
      await tx.delete(users).where(and(eq(users.id, guestUserId), eq(users.isGuest, true)));
    });
  }

  async getLeaderboard(limit = 20, offset = 0, timeWindow?: 'week' | 'month'): Promise<LeaderboardEntry[]> {
    if (timeWindow !== undefined) {
      const now = Date.now();
      const cutoff = new Date(now - (timeWindow === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000);
      const result = await this.db.execute(sql`
        WITH windowed AS (
          SELECT
            gp.user_id,
            u.display_name,
            u.avatar_url,
            COUNT(*)::int AS games_played,
            COUNT(*) FILTER (WHERE gp.result = 'WIN')::int AS games_won,
            COUNT(*) FILTER (WHERE gp.result = 'LOSS')::int AS games_lost,
            0::int AS games_abandoned
          FROM game_players gp
          JOIN games g ON g.id = gp.game_id
          JOIN users u ON u.id = gp.user_id
          WHERE
            gp.user_id IS NOT NULL
            AND u.is_guest = false
            AND g.ended_at IS NOT NULL
            AND g.is_abandoned = false
            AND g.ended_at >= ${cutoff}
          GROUP BY gp.user_id, u.display_name, u.avatar_url
        )
        SELECT * FROM windowed
        ORDER BY games_won DESC,
                 (games_won::float / games_played) DESC,
                 games_played DESC,
                 user_id ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return (result.rows as Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        games_played: number | string;
        games_won: number | string;
        games_lost: number | string;
      }>).map((row) =>
        toLeaderboardEntry({
          userId: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          gamesPlayed: Number(row.games_played),
          gamesWon: Number(row.games_won),
          gamesLost: Number(row.games_lost),
        })
      );
    }

    const rows = await this.db
      .select({
        userId: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        gamesPlayed: playerStats.gamesPlayed,
        gamesWon: playerStats.gamesWon,
        gamesLost: playerStats.gamesLost,
      })
      .from(playerStats)
      .innerJoin(users, eq(playerStats.userId, users.id))
      .where(and(eq(users.isGuest, false), sql`${playerStats.gamesPlayed} > 0`))
      .orderBy(
        desc(playerStats.gamesWon),
        // Secondary key only: the emitted winRate is derived in JS (see
        // toLeaderboardEntry); this SQL ratio just breaks gamesWon ties.
        sql`${playerStats.gamesWon}::float / ${playerStats.gamesPlayed} desc`,
        desc(playerStats.gamesPlayed),
        asc(users.id)
      )
      .limit(limit)
      .offset(offset);
    return rows.map(toLeaderboardEntry);
  }

  async getMyLeaderboardRank(userId: string, timeWindow?: 'week' | 'month'): Promise<RankedLeaderboardEntry | null> {
    if (timeWindow !== undefined) {
      const now = Date.now();
      const cutoff = new Date(now - (timeWindow === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000);
      const result = await this.db.execute(sql`
        WITH windowed AS (
          SELECT
            gp.user_id,
            u.display_name,
            u.avatar_url,
            COUNT(*)::int AS games_played,
            COUNT(*) FILTER (WHERE gp.result = 'WIN')::int AS games_won,
            COUNT(*) FILTER (WHERE gp.result = 'LOSS')::int AS games_lost,
            0::int AS games_abandoned
          FROM game_players gp
          JOIN games g ON g.id = gp.game_id
          JOIN users u ON u.id = gp.user_id
          WHERE
            gp.user_id IS NOT NULL
            AND u.is_guest = false
            AND g.ended_at IS NOT NULL
            AND g.is_abandoned = false
            AND g.ended_at >= ${cutoff}
          GROUP BY gp.user_id, u.display_name, u.avatar_url
        ),
        ranked AS (
          SELECT *,
            ROW_NUMBER() OVER (
              ORDER BY games_won DESC,
                       (games_won::float / games_played) DESC,
                       games_played DESC,
                       user_id ASC
            )::int AS rank
          FROM windowed
        )
        SELECT * FROM ranked WHERE user_id = ${userId}
      `);
      const row = result.rows[0] as {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        games_played: number | string;
        games_won: number | string;
        games_lost: number | string;
        rank: number | string;
      } | undefined;
      if (!row) return null;
      return {
        ...toLeaderboardEntry({
          userId: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          gamesPlayed: Number(row.games_played),
          gamesWon: Number(row.games_won),
          gamesLost: Number(row.games_lost),
        }),
        rank: Number(row.rank),
      };
    }

    const result = await this.db.execute(sql`
      WITH qualifying AS (
        SELECT
          u.id                    AS user_id,
          u.display_name,
          u.avatar_url,
          ps.games_played,
          ps.games_won,
          ps.games_lost,
          ROW_NUMBER() OVER (
            ORDER BY
              ps.games_won DESC,
              CASE WHEN ps.games_played > 0
                   THEN ps.games_won::float / ps.games_played
                   ELSE 0.0 END DESC,
              ps.games_played DESC,
              u.id ASC
          ) AS rank
        FROM player_stats ps
        INNER JOIN users u ON ps.user_id = u.id
        WHERE u.is_guest = false AND ps.games_played > 0
      )
      SELECT user_id, display_name, avatar_url, games_played, games_won, games_lost, rank
      FROM qualifying
      WHERE user_id = ${userId}
    `);
    const row = result.rows[0] as {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      games_played: number;
      games_won: number;
      games_lost: number;
      rank: string | number;
    } | undefined;
    if (!row) return null;
    const gamesPlayed = Number(row.games_played);
    const gamesWon = Number(row.games_won);
    const gamesLost = Number(row.games_lost);
    return {
      ...toLeaderboardEntry({
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        gamesPlayed,
        gamesWon,
        gamesLost,
      }),
      rank: Number(row.rank),
    };
  }

  // Recovery reads ----------------------------------------------------------

  async loadActiveGames(): Promise<GameWithPlayers[]> {
    const activeGames = await this.db
      .select({
        game: games,
        roomCode: rooms.roomCode,
        hostUserId: rooms.hostUserId,
      })
      .from(games)
      .innerJoin(rooms, eq(games.roomId, rooms.id))
      .where(and(eq(rooms.status, 'PLAYING'), sql`${games.endedAt} is null`))
      // Deterministic recovery order (startedAt is indexed); matches
      // MemoryPersistence insertion order.
      .orderBy(asc(games.startedAt));

    if (activeGames.length === 0) return [];

    // Batch the player fetch in a single query to avoid an N+1 loop.
    const gameIds = activeGames.map(({ game }) => game.id);
    const allPlayers = await this.db
      .select()
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, gameIds))
      .orderBy(asc(gamePlayers.seatIndex));

    const byGame = new Map<string, GamePlayerRow[]>();
    for (const p of allPlayers) {
      const list = byGame.get(p.gameId);
      if (list) list.push(p);
      else byGame.set(p.gameId, [p]);
    }

    return activeGames.map(({ game, roomCode, hostUserId }) => ({
      game,
      players: byGame.get(game.id) ?? [],
      roomCode,
      hostUserId,
    }));
  }

  async loadGameEvents(gameId: string): Promise<GameEventRow[]> {
    return this.db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId))
      .orderBy(asc(gameEvents.seq));
  }

  async loadGameWithPlayers(gameId: string): Promise<GameWithPlayers | null> {
    const gameRows = await this.db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    const game = gameRows[0];
    if (!game) return null;
    const players = await this.db
      .select()
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(asc(gamePlayers.seatIndex));
    return { game, players };
  }

  // Phase 8: co-player queries and blocks -----------------------------------

  async getFrequentCoPlayers(userId: string, limit = 20): Promise<CoPlayerEntry[]> {
    const result = await this.db.execute(sql`
      SELECT
        gp2.user_id        AS "userId",
        u.display_name     AS "displayName",
        u.avatar_url       AS "avatarUrl",
        COUNT(*)::int      AS "gamesPlayedTogether"
      FROM game_players gp1
      JOIN game_players gp2
        ON  gp2.game_id  = gp1.game_id
        AND gp2.user_id != gp1.user_id
        AND gp2.user_id IS NOT NULL
      JOIN users u ON u.id = gp2.user_id
      WHERE gp1.user_id = ${userId}
        AND u.is_guest = false
      GROUP BY gp2.user_id, u.display_name, u.avatar_url
      ORDER BY "gamesPlayedTogether" DESC, gp2.user_id ASC
      LIMIT ${limit}
    `);
    return (
      result.rows as Array<{
        userId: string;
        displayName: string;
        avatarUrl: string | null;
        gamesPlayedTogether: number;
      }>
    ).map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      gamesPlayedTogether: row.gamesPlayedTogether,
    }));
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId));
    return rows.map((r) => r.blockedId);
  }

  async getBlockedUsers(userId: string): Promise<BlockedUserEntry[]> {
    try {
      const rows = await this.db
        .select({
          userId: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(userBlocks)
        .innerJoin(users, eq(userBlocks.blockedId, users.id))
        .where(eq(userBlocks.blockerId, userId));
      return rows.map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      }));
    } catch {
      return [];
    }
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const rows = await this.db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
    return rows.length > 0;
  }

  async getAdminKpiStats(windowDays = 7): Promise<AdminKpiStats> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Query daily breakdown: group by UTC date of ended_at, count total/abandoned,
    // compute avg durationMs for completed games.
    const result = await this.db.execute(sql`
      SELECT
        TO_CHAR(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_abandoned = false)::int AS completed,
        COUNT(*) FILTER (WHERE is_abandoned = true)::int AS abandoned,
        COUNT(*) FILTER (WHERE is_abandoned = false AND duration_ms IS NOT NULL)::int AS completed_with_duration,
        AVG(duration_ms) FILTER (WHERE is_abandoned = false AND duration_ms IS NOT NULL) AS avg_duration_ms
      FROM games
      WHERE ended_at IS NOT NULL
        AND ended_at >= ${cutoff}
      GROUP BY TO_CHAR(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `);

    const rows = result.rows as Array<{
      date: string;
      total: number | string;
      completed: number | string;
      abandoned: number | string;
      completed_with_duration: number | string;
      avg_duration_ms: number | string | null;
    }>;

    const dailyBreakdown = rows.map((r) => ({
      date: r.date,
      total: Number(r.total),
      completed: Number(r.completed),
      abandoned: Number(r.abandoned),
    }));

    const totalGames = dailyBreakdown.reduce((s, r) => s + r.total, 0);
    const completedGames = dailyBreakdown.reduce((s, r) => s + r.completed, 0);
    const abandonedGames = dailyBreakdown.reduce((s, r) => s + r.abandoned, 0);
    const abandonmentRate = totalGames > 0 ? abandonedGames / totalGames : 0;

    // Compute overall avgDurationMs from the per-day weighted averages.
    // Weight by completed_with_duration (games that actually have a durationMs value),
    // not by completed — completed may include games where durationMs IS NULL.
    let weightedSum = 0;
    let weightedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const c = Number(r.completed_with_duration);
      if (c > 0 && r.avg_duration_ms != null) {
        weightedSum += Number(r.avg_duration_ms) * c;
        weightedCount += c;
      }
    }
    const avgDurationMs = weightedCount > 0 ? weightedSum / weightedCount : null;

    // Query A — avgXpGrantedPerDay
    const xpResult = await this.db.execute(sql`
      SELECT COALESCE(SUM(gp.xp_earned), 0) AS total_xp
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE g.ended_at IS NOT NULL
        AND g.ended_at >= ${cutoff}
        AND g.is_abandoned = false
        AND gp.xp_earned IS NOT NULL
    `);
    const totalXp = Number((xpResult.rows[0] as { total_xp: number | string } | undefined)?.total_xp ?? 0);
    const avgXpGrantedPerDay = totalXp > 0 && windowDays > 0 ? totalXp / windowDays : null;

    // Query B — avgMatchScoreByPlayerCount
    const matchScoreResult = await this.db.execute(sql`
      SELECT
        g.player_count,
        AVG(gp.match_score)::float AS avg_match_score,
        COUNT(DISTINCT g.id)::int AS game_count
      FROM games g
      JOIN game_players gp ON gp.game_id = g.id
      WHERE g.ended_at IS NOT NULL
        AND g.ended_at >= ${cutoff}
        AND g.is_abandoned = false
        AND gp.match_score IS NOT NULL
      GROUP BY g.player_count
      ORDER BY g.player_count ASC
    `);
    const avgMatchScoreByPlayerCount = (matchScoreResult.rows as Array<{
      player_count: number | string;
      avg_match_score: number | string;
      game_count: number | string;
    }>).map((r) => ({
      playerCount: Number(r.player_count),
      avgMatchScore: Number(r.avg_match_score),
      gameCount: Number(r.game_count),
    }));

    // Query C — abandonRatingImpact
    const ratingResult = await this.db.execute(sql`
      SELECT
        AVG(gp.ranked_rating_delta) FILTER (WHERE g.is_abandoned = false) AS avg_delta_completed,
        AVG(gp.ranked_rating_delta) FILTER (WHERE g.is_abandoned = true) AS avg_delta_abandoned
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE g.ended_at IS NOT NULL
        AND g.ended_at >= ${cutoff}
        AND gp.ranked_rating_delta IS NOT NULL
    `);
    const ratingRow = ratingResult.rows[0] as {
      avg_delta_completed: number | string | null;
      avg_delta_abandoned: number | string | null;
    } | undefined;
    const abandonRatingImpact = {
      avgRatingDeltaCompleted: ratingRow?.avg_delta_completed != null ? Number(ratingRow.avg_delta_completed) : null,
      avgRatingDeltaAbandoned: ratingRow?.avg_delta_abandoned != null ? Number(ratingRow.avg_delta_abandoned) : null,
    };

    return {
      windowDays,
      totalGames,
      completedGames,
      abandonedGames,
      abandonmentRate,
      avgDurationMs,
      dailyBreakdown,
      avgXpGrantedPerDay,
      avgMatchScoreByPlayerCount,
      abandonRatingImpact,
    };
  }

  async searchUsers(query: string, limit = 20): Promise<UserSearchResult[]> {
    const escaped = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escaped}%`;
    const result = await this.db.execute(sql`
      SELECT
        u.id          AS "userId",
        u.display_name AS "displayName",
        u.email,
        u.avatar_url   AS "avatarUrl",
        u.is_guest     AS "isGuest",
        COALESCE(ps.games_played, 0)::int AS "gamesPlayed",
        COALESCE(ps.games_won, 0)::int    AS "gamesWon"
      FROM users u
      LEFT JOIN player_stats ps ON ps.user_id = u.id
      WHERE
        u.display_name ILIKE ${pattern}
        OR u.email ILIKE ${pattern}
      ORDER BY u.display_name ASC
      LIMIT ${limit}
    `);
    return (result.rows as Array<{
      userId: string;
      displayName: string;
      email: string | null;
      avatarUrl: string | null;
      isGuest: boolean;
      gamesPlayed: number | string;
      gamesWon: number | string;
    }>).map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      email: row.email,
      avatarUrl: row.avatarUrl,
      isGuest: row.isGuest,
      gamesPlayed: Number(row.gamesPlayed),
      gamesWon: Number(row.gamesWon),
    }));
  }

  async adminGetUserStats(userId: string): Promise<AdminUserStats | null> {
    // Guard against invalid UUID strings that would cause a Postgres parse error.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(userId)) return null;

    const result = await this.db.execute(sql`
      SELECT
        u.id            AS "userId",
        u.display_name  AS "displayName",
        u.email,
        u.avatar_url    AS "avatarUrl",
        u.is_guest      AS "isGuest",
        COALESCE(ps.games_played, 0)::int       AS "gamesPlayed",
        COALESCE(ps.games_won, 0)::int          AS "gamesWon",
        COALESCE(ps.games_lost, 0)::int         AS "gamesLost",
        COALESCE(ps.games_abandoned, 0)::int    AS "gamesAbandoned",
        COALESCE(ps.total_captures, 0)::int     AS "totalCaptures",
        COALESCE(ps.cuts_given, 0)::int         AS "cutsGiven",
        COALESCE(ps.cuts_received, 0)::int      AS "cutsReceived",
        COALESCE(ps.times_safe, 0)::int         AS "timesSafe",
        COALESCE(ps.total_play_time_ms, 0)::bigint AS "totalPlayTimeMs",
        COALESCE(ps.longest_win_streak, 0)::int AS "longestWinStreak",
        COALESCE(ps.current_win_streak, 0)::int AS "currentWinStreak",
        COALESCE(ps.highest_match_score, 0)::int AS "highestMatchScore",
        COALESCE(ps.total_match_score, 0)::int AS "totalMatchScore",
        COALESCE(ps.ghost_finishes, 0)::int AS "ghostFinishes",
        ps.updated_at   AS "updatedAt"
      FROM users u
      LEFT JOIN player_stats ps ON ps.user_id = u.id
      LEFT JOIN player_progression pp ON pp.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `);
    const row = result.rows[0] as {
      userId: string;
      displayName: string;
      email: string | null;
      avatarUrl: string | null;
      isGuest: boolean;
      gamesPlayed: number | string;
      gamesWon: number | string;
      gamesLost: number | string;
      gamesAbandoned: number | string;
      totalCaptures: number | string;
      cutsGiven: number | string;
      cutsReceived: number | string;
      timesSafe: number | string;
      totalPlayTimeMs: number | string;
      longestWinStreak: number | string;
      currentWinStreak: number | string;
      highestMatchScore: number | string;
      totalMatchScore: number | string;
      ghostFinishes: number | string;
      updatedAt: Date | string | null;
    } | undefined;
    if (!row) return null;
    const gamesPlayed = Number(row.gamesPlayed);
    const gamesWon = Number(row.gamesWon);
    const winRate = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;
    const updatedAt = row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row.updatedAt === 'string'
        ? row.updatedAt
        : null;
    return {
      userId: row.userId,
      displayName: row.displayName,
      email: row.email,
      avatarUrl: row.avatarUrl,
      isGuest: row.isGuest,
      gamesPlayed,
      gamesWon,
      gamesLost: Number(row.gamesLost),
      gamesAbandoned: Number(row.gamesAbandoned),
      winRate,
      totalCaptures: Number(row.totalCaptures),
      cutsGiven: Number(row.cutsGiven),
      cutsReceived: Number(row.cutsReceived),
      timesSafe: Number(row.timesSafe),
      totalPlayTimeMs: Number(row.totalPlayTimeMs),
      longestWinStreak: Number(row.longestWinStreak),
      currentWinStreak: Number(row.currentWinStreak),
      highestMatchScore: Number(row.highestMatchScore),
      totalMatchScore: Number(row.totalMatchScore),
      ghostFinishes: Number(row.ghostFinishes),
      progression: await this.getPlayerProgression(userId),
      updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Stats: idempotent recompute from game_players
  // ---------------------------------------------------------------------------

  async recomputePlayerStats(userId?: string): Promise<number> {
    console.log(`[persistence] recomputePlayerStats: userId=${userId ?? '(all)'}`);

    // Determine which user IDs to recompute.
    let userIds: string[];
    if (userId !== undefined) {
      userIds = [userId];
    } else {
      // All distinct user_ids that have at least one game_players row.
      const rows = await this.db
        .selectDistinct({ userId: gamePlayers.userId })
        .from(gamePlayers)
        .where(sql`${gamePlayers.userId} IS NOT NULL`);
      userIds = rows.map((r) => r.userId).filter((id): id is string => id !== null);
    }

    if (userIds.length === 0) return 0;

    let count = 0;
    for (const uid of userIds) {
      await this._recomputeOneUser(uid);
      count += 1;
    }
    return count;
  }

  private async _recomputeOneUser(userId: string): Promise<void> {
    // Step 1: aggregate from game_players JOIN games for computable fields.
    const aggResult = await this.db.execute(sql`
      SELECT
        COUNT(*)::int                                                                AS games_played,
        COUNT(*) FILTER (WHERE gp.final_rank = 1)::int                             AS games_won,
        COUNT(*) FILTER (WHERE gp.result = 'LOSS')::int                            AS games_lost,
        COUNT(*) FILTER (WHERE gp.result = 'ABANDONED')::int                       AS games_abandoned,
        COALESCE(SUM(gp.capture_count), 0)::int                                    AS total_captures,
        COALESCE(SUM(CASE WHEN gp.result != 'ABANDONED' THEN COALESCE(gp.final_rank, 0) ELSE 0 END), 0)::int
                                                                                   AS sum_finish_positions,
        COALESCE(SUM(COALESCE(g.duration_ms, 0)), 0)::bigint                       AS total_play_time_ms,
        COALESCE(MAX(COALESCE(gp.match_score, 0)), 0)::int                         AS highest_match_score,
        COALESCE(SUM(COALESCE(gp.match_score, 0)), 0)::int                         AS total_match_score
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE gp.user_id = ${userId}
    `);
    const agg = aggResult.rows[0] as {
      games_played: number | string;
      games_won: number | string;
      games_lost: number | string;
      games_abandoned: number | string;
      total_captures: number | string;
      sum_finish_positions: number | string;
      total_play_time_ms: number | string;
      highest_match_score: number | string;
      total_match_score: number | string;
    } | undefined;

    if (!agg) return;

    const gamesPlayed = Number(agg.games_played);
    const gamesWon = Number(agg.games_won);
    const gamesLost = Number(agg.games_lost);
    const gamesAbandoned = Number(agg.games_abandoned);
    const totalCaptures = Number(agg.total_captures);
    const sumFinishPositions = Number(agg.sum_finish_positions);
    const totalPlayTimeMs = Number(agg.total_play_time_ms);
    const highestMatchScore = Number(agg.highest_match_score);
    const totalMatchScore = Number(agg.total_match_score);

    // Step 2: compute win streaks from ordered game results.
    const streakResult = await this.db.execute(sql`
      SELECT gp.final_rank, gp.result
      FROM game_players gp
      JOIN games g ON g.id = gp.game_id
      WHERE gp.user_id = ${userId}
        AND g.ended_at IS NOT NULL
      ORDER BY g.ended_at ASC
    `);
    const rows = streakResult.rows as Array<{ final_rank: number | null; result: string | null }>;
    let currentWinStreak = 0;
    let longestWinStreak = 0;
    let tempStreak = 0;
    for (const row of rows) {
      if (row.result === 'ABANDONED') continue; // skip abandoned
      if (row.final_rank === 1) {
        tempStreak += 1;
        if (tempStreak > longestWinStreak) longestWinStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    currentWinStreak = tempStreak;

    // Step 3: upsert into player_stats.
    // Fields we cannot derive from game_players (cutsGiven, cutsReceived, timesSafe,
    // ghostFinishes) are set to 0 on INSERT (first-ever row) and explicitly kept as
    // player_stats.<col> on CONFLICT UPDATE, so a recompute never overwrites them.
    await this.db.execute(sql`
      INSERT INTO player_stats (
        user_id,
        games_played,
        games_won,
        games_lost,
        games_abandoned,
        total_captures,
        cuts_given,
        cuts_received,
        times_safe,
        total_play_time_ms,
        longest_win_streak,
        current_win_streak,
        sum_finish_positions,
        highest_match_score,
        total_match_score,
        ghost_finishes,
        updated_at
      )
      VALUES (
        ${userId},
        ${gamesPlayed},
        ${gamesWon},
        ${gamesLost},
        ${gamesAbandoned},
        ${totalCaptures},
        0,
        0,
        0,
        ${totalPlayTimeMs},
        ${longestWinStreak},
        ${currentWinStreak},
        ${sumFinishPositions},
        ${highestMatchScore},
        ${totalMatchScore},
        0,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        games_played         = EXCLUDED.games_played,
        games_won            = EXCLUDED.games_won,
        games_lost           = EXCLUDED.games_lost,
        games_abandoned      = EXCLUDED.games_abandoned,
        total_captures       = EXCLUDED.total_captures,
        cuts_given           = player_stats.cuts_given,
        cuts_received        = player_stats.cuts_received,
        times_safe           = player_stats.times_safe,
        ghost_finishes       = player_stats.ghost_finishes,
        total_play_time_ms   = EXCLUDED.total_play_time_ms,
        longest_win_streak   = EXCLUDED.longest_win_streak,
        current_win_streak   = EXCLUDED.current_win_streak,
        sum_finish_positions = EXCLUDED.sum_finish_positions,
        highest_match_score  = EXCLUDED.highest_match_score,
        total_match_score    = EXCLUDED.total_match_score,
        updated_at           = NOW()
    `);
  }

  async exportGamesData(limit = 500): Promise<ExportGameRow[]> {
    // Step 1: fetch games ordered newest-first, limited.
    const gameRows = await this.db
      .select({ game: games, roomCode: rooms.roomCode })
      .from(games)
      .leftJoin(rooms, eq(games.roomId, rooms.id))
      .orderBy(desc(games.startedAt))
      .limit(limit);

    if (gameRows.length === 0) return [];

    const gameIds = gameRows.map((r) => r.game.id);

    // Step 2: fetch all player rows for those games.
    const allPlayers = await this.db
      .select()
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, gameIds))
      .orderBy(asc(gamePlayers.seatIndex));

    const byGame = new Map<string, GamePlayerRow[]>();
    for (const p of allPlayers) {
      const list = byGame.get(p.gameId);
      if (list) list.push(p);
      else byGame.set(p.gameId, [p]);
    }

    return gameRows.map(({ game, roomCode }) => ({
      id: game.id,
      roomCode: roomCode ?? null,
      seed: game.seed,
      startedAt: game.startedAt instanceof Date
        ? game.startedAt.toISOString()
        : String(game.startedAt),
      endedAt: game.endedAt instanceof Date
        ? game.endedAt.toISOString()
        : game.endedAt != null
          ? String(game.endedAt)
          : null,
      durationMs: game.durationMs,
      playerCount: game.playerCount,
      isAbandoned: game.isAbandoned,
      winnerId: game.winnerId,
      players: (byGame.get(game.id) ?? []).map((p) => ({
        userId: p.userId,
        displayName: p.displayNameSnapshot,
        seatIndex: p.seatIndex,
        finalRank: p.finalRank,
        captureCount: p.captureCount,
        wasCut: p.wasCut,
        result: p.result,
        matchScore: p.matchScore,
        xpEarned: p.xpEarned,
        rankedRatingDelta: p.rankedRatingDelta,
      })),
    }));
  }
}

/** Alias matching the DEVELOPMENT_PLAN naming. */
export const PostgresStore = PgPersistence;

/** The joined columns a leaderboard query selects, before winRate derivation. */
export interface LeaderboardRowInput {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
}

/**
 * Project a joined (player_stats + users) row into a `LeaderboardEntry`. The
 * winRate is always derived in JS (0-guarded) — never trusted from a SQL float.
 * Shared by both persistence implementations so the shape is identical.
 */
export function toLeaderboardEntry(row: LeaderboardRowInput): LeaderboardEntry {
  return {
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    gamesLost: row.gamesLost,
    winRate: row.gamesPlayed > 0 ? row.gamesWon / row.gamesPlayed : 0,
  };
}

/**
 * Project a game row + its player rows into a `GameHistoryEntry` for `userId`.
 * Shared by both persistence implementations so the shape is identical.
 */
export function toHistoryEntry(
  game: GameRow,
  players: GamePlayerRow[],
  userId: string
): GameHistoryEntry {
  const toPlayer = (p: GamePlayerRow): GameHistoryPlayer => ({
    userId: p.userId,
    displayNameSnapshot: p.displayNameSnapshot,
    seatIndex: p.seatIndex,
    finalRank: p.finalRank,
    result: p.result,
    captureCount: p.captureCount,
    wasCut: p.wasCut,
    matchScore: p.matchScore,
    xpEarned: p.xpEarned,
    rankedRatingDelta: p.rankedRatingDelta,
  });
  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const mine = ordered.find((p) => p.userId === userId);
  if (!mine) {
    throw new Error(
      `toHistoryEntry: user ${userId} has no game_players row in game ${game.id}`
    );
  }
  return {
    game: {
      id: game.id,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      durationMs: game.durationMs,
      playerCount: game.playerCount,
      isAbandoned: game.isAbandoned,
      winnerId: game.winnerId,
    },
    you: toPlayer(mine),
    players: ordered.map(toPlayer),
    matchScore: mine.matchScore,
    xpEarned: mine.xpEarned,
    rankedRatingDelta: mine.rankedRatingDelta,
  };
}

function toPlayerProgression(row: PlayerProgressionRow): PlayerProgression {
  return {
    userId: row.userId,
    rankedRating: row.rankedRating,
    totalXp: row.totalXp,
    level: row.level,
    highestMatchScore: row.highestMatchScore,
    totalMatchScore: row.totalMatchScore,
    ghostFinishes: row.ghostFinishes,
    updatedAt: row.updatedAt,
  };
}

function toScoreLedgerEntry(row: typeof scoreLedger.$inferSelect): ScoreLedgerEntry {
  return {
    id: row.id,
    userId: row.userId,
    gameId: row.gameId,
    kind: row.kind,
    reason: row.reason,
    delta: row.delta,
    createdAt: row.createdAt,
    metaJson: (row.metaJson as Record<string, unknown> | null) ?? null,
  };
}

function toLedgerRows(gameId: string, player: ScoredGamePlayerResult): Array<{
  userId: string;
  gameId: string;
  kind: ScoreLedgerKind;
  reason: ScoreLedgerReason;
  delta: number;
  createdAt: Date;
  metaJson: Record<string, unknown> | null;
}> {
  if (player.userId === null) return [];
  const createdAt = player.progressionAfter?.updatedAt ?? new Date();
  const rows: Array<{
    userId: string;
    gameId: string;
    kind: ScoreLedgerKind;
    reason: ScoreLedgerReason;
    delta: number;
    createdAt: Date;
    metaJson: Record<string, unknown> | null;
  }> = [];
  for (const row of player.matchScoreBreakdown) {
    rows.push({
      userId: player.userId,
      gameId,
      kind: 'MATCH_SCORE',
      reason: row.reason,
      delta: row.delta,
      createdAt,
      metaJson: (row.meta as Record<string, unknown> | null) ?? null,
    });
  }
  for (const row of player.ratingBreakdown) {
    rows.push({
      userId: player.userId,
      gameId,
      kind: 'RANKED_RATING',
      reason: row.reason,
      delta: row.delta,
      createdAt,
      metaJson: (row.meta as Record<string, unknown> | null) ?? null,
    });
  }
  for (const row of player.xpBreakdown) {
    rows.push({
      userId: player.userId,
      gameId,
      kind: 'XP',
      reason: row.reason,
      delta: row.delta,
      createdAt,
      metaJson: (row.meta as Record<string, unknown> | null) ?? null,
    });
  }
  return rows;
}
