/**
 * MemoryPersistence — in-memory `GamePersistence` backed by Maps.
 *
 * Mirrors the Postgres semantics (seq uniqueness, upsert idempotency, recovery
 * reads) so the same contract test-suite passes against both. Enables DB-less
 * runs and fast unit tests. This is distinct from a future server-side
 * `MemoryStore` runtime store — it is the durable-repository shape.
 */

import type { Database } from '../db';
import { PgPersistence } from './pg';
import { toPlayerStatsView } from './types';
import type {
  AppendEventInput,
  GameEventRow,
  GamePersistence,
  GamePlayerRow,
  GameRow,
  GameWithPlayers,
  NewUser,
  PlayerStatsDelta,
  PlayerStatsRow,
  PlayerStatsView,
  RecordGameFinishedInput,
  RecordGameStartedInput,
  RoomRow,
  RoomStatus,
  UserRow,
} from './types';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(16)}-${Date.now().toString(16)}`;
}

export class MemoryPersistence implements GamePersistence {
  private readonly users = new Map<string, UserRow>();
  private readonly rooms = new Map<string, RoomRow>();
  private readonly games = new Map<string, GameRow>();
  private readonly gamePlayers = new Map<string, GamePlayerRow>();
  private readonly events = new Map<string, GameEventRow>();
  private readonly stats = new Map<string, PlayerStatsRow>();
  /** Enforces (gameId, seq) uniqueness. */
  private readonly eventSeq = new Set<string>();

  // Users -------------------------------------------------------------------

  async upsertUser(user: NewUser & { id: string }): Promise<UserRow> {
    const existing = this.users.get(user.id);
    const row: UserRow = {
      id: user.id,
      displayName: user.displayName,
      email: user.email ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      lastSeenAt: new Date(),
      isGuest: user.isGuest ?? existing?.isGuest ?? true,
    };
    this.users.set(user.id, row);
    return row;
  }

  async ensureGuest(id: string, displayName: string): Promise<UserRow> {
    const existing = this.users.get(id);
    if (existing) {
      const updated = { ...existing, lastSeenAt: new Date() };
      this.users.set(id, updated);
      return updated;
    }
    const row: UserRow = {
      id,
      displayName,
      email: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      isGuest: true,
    };
    this.users.set(id, row);
    return row;
  }

  // Rooms -------------------------------------------------------------------

  async recordRoomCreated(input: {
    roomCode: string;
    hostUserId: string;
    configSnapshot?: unknown;
    status?: RoomStatus;
  }): Promise<RoomRow> {
    for (const r of this.rooms.values()) {
      if (r.roomCode === input.roomCode) {
        throw new Error(`duplicate room_code ${input.roomCode}`);
      }
    }
    if (!this.users.has(input.hostUserId)) {
      throw new Error(`FK violation: host ${input.hostUserId} not found`);
    }
    const row: RoomRow = {
      id: newId('room'),
      roomCode: input.roomCode,
      hostUserId: input.hostUserId,
      status: input.status ?? 'LOBBY',
      configSnapshot: input.configSnapshot ?? null,
      createdAt: new Date(),
      closedAt: null,
    };
    this.rooms.set(row.id, row);
    return row;
  }

  async updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    closedAt?: Date | null
  ): Promise<RoomRow | null> {
    const existing = this.rooms.get(roomId);
    if (!existing) return null;
    const updated: RoomRow = {
      ...existing,
      status,
      closedAt: closedAt !== undefined ? closedAt : existing.closedAt,
    };
    this.rooms.set(roomId, updated);
    return updated;
  }

  // Games -------------------------------------------------------------------

  async recordGameStarted(input: RecordGameStartedInput): Promise<GameRow> {
    if (!this.rooms.has(input.roomId)) {
      throw new Error(`FK violation: room ${input.roomId} not found`);
    }
    const row: GameRow = {
      id: newId('game'),
      roomId: input.roomId,
      seed: String(input.seed),
      seatingOrder: [...input.seatingOrder],
      playerCount: input.playerCount ?? input.seatingOrder.length,
      configSnapshot: input.configSnapshot ?? null,
      startedAt: input.startedAt ?? new Date(),
      endedAt: null,
      durationMs: null,
      winnerId: null,
      isAbandoned: false,
    };
    this.games.set(row.id, row);
    return row;
  }

  async recordGameFinished(
    input: RecordGameFinishedInput
  ): Promise<GameWithPlayers> {
    const game = this.games.get(input.gameId);
    if (!game) {
      throw new Error(`recordGameFinished: game ${input.gameId} not found`);
    }
    const updated: GameRow = {
      ...game,
      endedAt: input.endedAt ?? new Date(),
      durationMs: input.durationMs ?? null,
      winnerId: input.winnerId ?? null,
      isAbandoned: input.isAbandoned ?? false,
    };
    this.games.set(updated.id, updated);

    // Idempotent against (gameId, seatIndex): a second call (retry / double
    // GAME_OVER) updates the existing row in place rather than duplicating it.
    // Mirrors the PgPersistence onConflictDoUpdate semantics.
    const players: GamePlayerRow[] = input.players.map((p) => {
      const existing = [...this.gamePlayers.values()].find(
        (gp) => gp.gameId === input.gameId && gp.seatIndex === p.seatIndex
      );
      const row: GamePlayerRow = {
        id: existing?.id ?? newId('gp'),
        gameId: input.gameId,
        userId: p.userId,
        seatIndex: p.seatIndex,
        displayNameSnapshot: p.displayName,
        finalRank: p.finalRank,
        wasCut: p.wasCut,
        captureCount: p.captureCount,
        result: p.result,
      };
      this.gamePlayers.set(row.id, row);
      return row;
    });
    return { game: updated, players };
  }

  // Events ------------------------------------------------------------------

  private insertEvent(input: AppendEventInput): GameEventRow {
    const key = `${input.gameId}#${input.seq}`;
    if (this.eventSeq.has(key)) {
      throw new Error(`duplicate (game_id, seq): ${key}`);
    }
    if (!this.games.has(input.gameId)) {
      throw new Error(`FK violation: game ${input.gameId} not found`);
    }
    this.eventSeq.add(key);
    const row: GameEventRow = {
      id: newId('ev'),
      gameId: input.gameId,
      seq: input.seq,
      ts: input.ts ?? new Date(),
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      payload: input.payload,
    };
    this.events.set(row.id, row);
    return row;
  }

  async appendGameEvent(input: AppendEventInput): Promise<GameEventRow> {
    return this.insertEvent(input);
  }

  async appendGameEvents(
    events: readonly AppendEventInput[]
  ): Promise<GameEventRow[]> {
    if (events.length === 0) return [];
    // Transactional: validate all before committing any.
    const seen = new Set<string>();
    for (const e of events) {
      const key = `${e.gameId}#${e.seq}`;
      if (this.eventSeq.has(key) || seen.has(key)) {
        throw new Error(`duplicate (game_id, seq): ${key}`);
      }
      if (!this.games.has(e.gameId)) {
        throw new Error(`FK violation: game ${e.gameId} not found`);
      }
      seen.add(key);
    }
    return events.map((e) => this.insertEvent(e));
  }

  // Stats -------------------------------------------------------------------

  async upsertPlayerStats(delta: PlayerStatsDelta): Promise<PlayerStatsRow> {
    const inc = (n?: number) => n ?? 0;
    const existing = this.stats.get(delta.userId);
    if (!existing) {
      const row: PlayerStatsRow = {
        id: newId('stats'),
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
        updatedAt: new Date(),
      };
      this.stats.set(delta.userId, row);
      return row;
    }
    const updated: PlayerStatsRow = {
      ...existing,
      gamesPlayed: existing.gamesPlayed + inc(delta.gamesPlayed),
      gamesWon: existing.gamesWon + inc(delta.gamesWon),
      gamesLost: existing.gamesLost + inc(delta.gamesLost),
      gamesAbandoned: existing.gamesAbandoned + inc(delta.gamesAbandoned),
      totalCaptures: existing.totalCaptures + inc(delta.totalCaptures),
      cutsGiven: existing.cutsGiven + inc(delta.cutsGiven),
      cutsReceived: existing.cutsReceived + inc(delta.cutsReceived),
      timesSafe: existing.timesSafe + inc(delta.timesSafe),
      totalPlayTimeMs: existing.totalPlayTimeMs + inc(delta.totalPlayTimeMs),
      longestWinStreak:
        delta.longestWinStreak !== undefined
          ? delta.longestWinStreak
          : existing.longestWinStreak,
      currentWinStreak:
        delta.currentWinStreak !== undefined
          ? delta.currentWinStreak
          : existing.currentWinStreak,
      updatedAt: new Date(),
    };
    this.stats.set(delta.userId, updated);
    return updated;
  }

  async getPlayerStats(userId: string): Promise<PlayerStatsRow | null> {
    return this.stats.get(userId) ?? null;
  }

  async getPlayerStatsView(userId: string): Promise<PlayerStatsView | null> {
    const stats = this.stats.get(userId);
    if (!stats) return null;
    // Mean of this user's non-null finalRank values across all games.
    const ranks: number[] = [];
    for (const gp of this.gamePlayers.values()) {
      if (gp.userId === userId && gp.finalRank !== null) {
        ranks.push(gp.finalRank);
      }
    }
    const averageFinishPosition =
      ranks.length === 0
        ? null
        : ranks.reduce((sum, r) => sum + r, 0) / ranks.length;
    return toPlayerStatsView(stats, averageFinishPosition);
  }

  // Recovery reads ----------------------------------------------------------

  async loadActiveGames(): Promise<GameWithPlayers[]> {
    const playingRoomIds = new Set(
      [...this.rooms.values()]
        .filter((r) => r.status === 'PLAYING')
        .map((r) => r.id)
    );
    return [...this.games.values()]
      .filter((g) => playingRoomIds.has(g.roomId) && g.endedAt == null)
      // Deterministic recovery order by startedAt (ties fall back to insertion
      // order via stable sort), matching PgPersistence.
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((game) => ({ game, players: this.playersOf(game.id) }));
  }

  async loadGameEvents(gameId: string): Promise<GameEventRow[]> {
    return [...this.events.values()]
      .filter((e) => e.gameId === gameId)
      .sort((a, b) => a.seq - b.seq);
  }

  async loadGameWithPlayers(gameId: string): Promise<GameWithPlayers | null> {
    const game = this.games.get(gameId);
    if (!game) return null;
    return { game, players: this.playersOf(gameId) };
  }

  private playersOf(gameId: string): GamePlayerRow[] {
    return [...this.gamePlayers.values()]
      .filter((p) => p.gameId === gameId)
      .sort((a, b) => a.seatIndex - b.seatIndex);
  }
}

/**
 * Factory: returns a Postgres-backed persistence when a Drizzle db is provided,
 * otherwise an in-memory one (DB-less mode).
 */
export function createPersistence(db?: Database | null): GamePersistence {
  return db ? new PgPersistence(db) : new MemoryPersistence();
}
