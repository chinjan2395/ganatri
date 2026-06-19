/**
 * PgPersistence — Postgres-backed `GamePersistence` (Drizzle query builder).
 *
 * Constructor takes an injected Drizzle database so tests can pass a
 * pglite-backed instance and production passes `getDb()`. Multi-row writes go
 * through `db.transaction`; upserts use `onConflictDoUpdate` /
 * `onConflictDoNothing`.
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db';
import {
  games,
  gameEvents,
  gamePlayers,
  playerStats,
  rooms,
  users,
} from '../schema';
import type {
  AppendEventInput,
  FinalPlayerResult,
  GameEventRow,
  GamePersistence,
  GamePlayerRow,
  GameRow,
  GameWithPlayers,
  NewUser,
  PlayerStatsDelta,
  PlayerStatsRow,
  RecordGameFinishedInput,
  RecordGameStartedInput,
  RoomRow,
  RoomStatus,
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
