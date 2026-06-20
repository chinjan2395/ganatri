/**
 * PgPersistence — Postgres-backed `GamePersistence` (Drizzle query builder).
 *
 * Constructor takes an injected Drizzle database so tests can pass a
 * pglite-backed instance and production passes `getDb()`. Multi-row writes go
 * through `db.transaction`; upserts use `onConflictDoUpdate` /
 * `onConflictDoNothing`.
 */

import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Database } from '../db';
import {
  authSessions,
  games,
  gameEvents,
  gamePlayers,
  oauthAccounts,
  playerStats,
  rooms,
  users,
} from '../schema';
import type {
  AppendEventInput,
  CreateAuthSessionInput,
  FinalPlayerResult,
  GameEventRow,
  GameHistoryEntry,
  GameHistoryPlayer,
  GamePersistence,
  GamePlayerRow,
  GameRow,
  GameWithPlayers,
  LeaderboardEntry,
  NewUser,
  PlayerStatsDelta,
  PlayerStatsRow,
  RankedLeaderboardEntry,
  RecordGameFinishedInput,
  RecordGameStartedInput,
  RoomRow,
  RoomStatus,
  UpsertOAuthUserInput,
  UserRow,
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

  // Auth (OAuth + sessions) -------------------------------------------------

  async upsertOAuthUser(input: UpsertOAuthUserInput): Promise<UserRow> {
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
        return updated[0]!;
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
          return updated[0]!;
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
      return user;
    });
  }

  async createAuthSession(input: CreateAuthSessionInput): Promise<void> {
    await this.db.insert(authSessions).values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
    });
  }

  async getUserBySessionTokenHash(tokenHash: string): Promise<UserRow | null> {
    const rows = await this.db
      .select({ user: users })
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
    return rows[0]?.user ?? null;
  }

  async revokeAuthSession(tokenHash: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revoked: true })
      .where(eq(authSessions.tokenHash, tokenHash));
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
      .select({ game: games })
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

    return activeGames.map(({ game }) => ({
      game,
      players: byGame.get(game.id) ?? [],
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
  };
}
