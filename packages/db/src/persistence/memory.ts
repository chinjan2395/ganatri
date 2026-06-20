/**
 * MemoryPersistence — in-memory `GamePersistence` backed by Maps.
 *
 * Mirrors the Postgres semantics (seq uniqueness, upsert idempotency, recovery
 * reads) so the same contract test-suite passes against both. Enables DB-less
 * runs and fast unit tests. This is distinct from a future server-side
 * `MemoryStore` runtime store — it is the durable-repository shape.
 */

import type { Database } from '../db';
import { PgPersistence, toHistoryEntry, toLeaderboardEntry } from './pg';
import type {
  AppendEventInput,
  AuthSessionRow,
  CreateAuthSessionInput,
  GameEventRow,
  GameHistoryEntry,
  GamePersistence,
  GamePlayerRow,
  GameRow,
  GameWithPlayers,
  LeaderboardEntry,
  NewUser,
  OAuthAccountRow,
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
  private readonly oauthAccounts = new Map<string, OAuthAccountRow>();
  private readonly authSessions = new Map<string, AuthSessionRow>();
  /** Enforces (gameId, seq) uniqueness. */
  private readonly eventSeq = new Set<string>();

  // Users -------------------------------------------------------------------

  async upsertUser(user: NewUser & { id: string }): Promise<UserRow> {
    const existing = this.users.get(user.id);
    const row: UserRow = {
      id: user.id,
      displayName: user.displayName,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? existing?.avatarUrl ?? null,
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
      avatarUrl: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      isGuest: true,
    };
    this.users.set(id, row);
    return row;
  }

  // Auth (OAuth + sessions) -------------------------------------------------

  async upsertOAuthUser(input: UpsertOAuthUserInput): Promise<UserRow> {
    // (a) Existing federated identity.
    const account = [...this.oauthAccounts.values()].find(
      (a) => a.provider === input.provider && a.providerUserId === input.providerUserId
    );
    if (account) {
      const user = this.users.get(account.userId)!;
      const updated: UserRow = {
        ...user,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        lastSeenAt: new Date(),
      };
      this.users.set(updated.id, updated);
      return updated;
    }

    // (b) Match an existing user by email -> link a new account.
    if (input.email !== null) {
      const existing = [...this.users.values()].find((u) => u.email === input.email);
      if (existing) {
        this.insertOAuthAccount(existing.id, input.provider, input.providerUserId);
        const updated: UserRow = {
          ...existing,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl ?? null,
          isGuest: false,
          lastSeenAt: new Date(),
        };
        this.users.set(updated.id, updated);
        return updated;
      }
    }

    // (c) Create a fresh (non-guest) user + linked account.
    const user: UserRow = {
      id: newId('user'),
      displayName: input.displayName,
      email: input.email ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      isGuest: false,
    };
    this.users.set(user.id, user);
    this.insertOAuthAccount(user.id, input.provider, input.providerUserId);
    return user;
  }

  private insertOAuthAccount(
    userId: string,
    provider: string,
    providerUserId: string
  ): void {
    const row: OAuthAccountRow = {
      id: newId('oauth'),
      userId,
      provider,
      providerUserId,
      createdAt: new Date(),
    };
    this.oauthAccounts.set(row.id, row);
  }

  async createAuthSession(input: CreateAuthSessionInput): Promise<void> {
    if (!this.users.has(input.userId)) {
      throw new Error(`FK violation: user ${input.userId} not found`);
    }
    const row: AuthSessionRow = {
      id: newId('sess'),
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
      revoked: false,
      userAgent: input.userAgent ?? null,
    };
    this.authSessions.set(row.id, row);
  }

  async getUserBySessionTokenHash(tokenHash: string): Promise<UserRow | null> {
    const now = Date.now();
    const session = [...this.authSessions.values()].find(
      (s) =>
        s.tokenHash === tokenHash &&
        !s.revoked &&
        s.expiresAt.getTime() > now
    );
    if (!session) return null;
    return this.users.get(session.userId) ?? null;
  }

  async revokeAuthSession(tokenHash: string): Promise<void> {
    for (const [id, s] of this.authSessions) {
      if (s.tokenHash === tokenHash) {
        this.authSessions.set(id, { ...s, revoked: true });
      }
    }
  }

  // History -----------------------------------------------------------------

  async getUserGameHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<GameHistoryEntry[]> {
    const myGameIds = new Set(
      [...this.gamePlayers.values()]
        .filter((p) => p.userId === userId)
        .map((p) => p.gameId)
    );
    const sorted = [...this.games.values()]
      .filter((g) => myGameIds.has(g.id))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(offset, offset + limit);

    return sorted.map((game) =>
      toHistoryEntry(game, this.playersOf(game.id), userId)
    );
  }

  // Retention ---------------------------------------------------------------

  async pruneGameEventsBefore(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const [id, ev] of this.events) {
      if (ev.ts.getTime() < cutoff.getTime()) {
        this.events.delete(id);
        this.eventSeq.delete(`${ev.gameId}#${ev.seq}`);
        deleted += 1;
      }
    }
    return deleted;
  }

  async pruneAbandonedGamesBefore(cutoff: Date): Promise<number> {
    const targets = [...this.games.values()].filter(
      (g) => g.isAbandoned && g.endedAt != null && g.endedAt.getTime() < cutoff.getTime()
    );
    if (targets.length === 0) return 0;
    const ids = new Set(targets.map((g) => g.id));

    for (const [id, ev] of this.events) {
      if (ids.has(ev.gameId)) {
        this.events.delete(id);
        this.eventSeq.delete(`${ev.gameId}#${ev.seq}`);
      }
    }
    for (const [id, gp] of this.gamePlayers) {
      if (ids.has(gp.gameId)) this.gamePlayers.delete(id);
    }
    for (const id of ids) this.games.delete(id);
    return ids.size;
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
        sumFinishPositions: inc(delta.sumFinishPositions),
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
      sumFinishPositions: existing.sumFinishPositions + inc(delta.sumFinishPositions),
      updatedAt: new Date(),
    };
    this.stats.set(delta.userId, updated);
    return updated;
  }

  async getPlayerStats(userId: string): Promise<PlayerStatsRow | null> {
    return this.stats.get(userId) ?? null;
  }

  async getLeaderboard(limit = 20, offset = 0, timeWindow?: 'week' | 'month'): Promise<LeaderboardEntry[]> {
    if (timeWindow !== undefined) {
      const now = Date.now();
      const cutoff = new Date(now - (timeWindow === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000);
      const qualifying = this.aggregateWindowed(cutoff);
      return qualifying.slice(offset, offset + limit).map((row) =>
        toLeaderboardEntry({
          userId: row.userId,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          gamesPlayed: row.gamesPlayed,
          gamesWon: row.gamesWon,
          gamesLost: row.gamesLost,
        })
      );
    }

    const winRate = (s: PlayerStatsRow) =>
      s.gamesPlayed > 0 ? s.gamesWon / s.gamesPlayed : 0;
    const qualifying = [...this.stats.values()]
      .map((s) => ({ stats: s, user: this.users.get(s.userId) }))
      .filter(
        (
          row
        ): row is { stats: PlayerStatsRow; user: UserRow } =>
          row.user !== undefined && !row.user.isGuest && row.stats.gamesPlayed > 0
      );
    // Same tiebreak chain as the SQL ORDER BY:
    // gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC (stable).
    qualifying.sort((a, b) => {
      if (b.stats.gamesWon !== a.stats.gamesWon) {
        return b.stats.gamesWon - a.stats.gamesWon;
      }
      const wr = winRate(b.stats) - winRate(a.stats);
      if (wr !== 0) return wr;
      if (b.stats.gamesPlayed !== a.stats.gamesPlayed) {
        return b.stats.gamesPlayed - a.stats.gamesPlayed;
      }
      return a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0;
    });
    return qualifying.slice(offset, offset + limit).map((row) =>
      toLeaderboardEntry({
        userId: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
        gamesPlayed: row.stats.gamesPlayed,
        gamesWon: row.stats.gamesWon,
        gamesLost: row.stats.gamesLost,
      })
    );
  }

  async getMyLeaderboardRank(userId: string, timeWindow?: 'week' | 'month'): Promise<RankedLeaderboardEntry | null> {
    const user = this.users.get(userId);
    if (!user || user.isGuest) return null;

    if (timeWindow !== undefined) {
      const now = Date.now();
      const cutoff = new Date(now - (timeWindow === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000);
      const qualifying = this.aggregateWindowed(cutoff);
      const idx = qualifying.findIndex((row) => row.userId === userId);
      if (idx === -1) return null;
      const entry = qualifying[idx]!;
      return {
        ...toLeaderboardEntry({
          userId: entry.userId,
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          gamesPlayed: entry.gamesPlayed,
          gamesWon: entry.gamesWon,
          gamesLost: entry.gamesLost,
        }),
        rank: idx + 1,
      };
    }

    const stats = this.stats.get(userId);
    if (!stats || stats.gamesPlayed === 0) return null;

    const winRate = (s: PlayerStatsRow) =>
      s.gamesPlayed > 0 ? s.gamesWon / s.gamesPlayed : 0;
    const qualifying = [...this.stats.values()]
      .map((s) => ({ stats: s, user: this.users.get(s.userId) }))
      .filter(
        (row): row is { stats: PlayerStatsRow; user: UserRow } =>
          row.user !== undefined && !row.user.isGuest && row.stats.gamesPlayed > 0
      );
    // Same tiebreak sort as getLeaderboard.
    qualifying.sort((a, b) => {
      if (b.stats.gamesWon !== a.stats.gamesWon) return b.stats.gamesWon - a.stats.gamesWon;
      const wr = winRate(b.stats) - winRate(a.stats);
      if (wr !== 0) return wr;
      if (b.stats.gamesPlayed !== a.stats.gamesPlayed) return b.stats.gamesPlayed - a.stats.gamesPlayed;
      return a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0;
    });
    const idx = qualifying.findIndex((row) => row.user.id === userId);
    if (idx === -1) return null;
    return {
      ...toLeaderboardEntry({
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        gamesLost: stats.gamesLost,
      }),
      rank: idx + 1,
    };
  }

  /**
   * Aggregate game_players + games for a time-windowed leaderboard.
   * Returns entries sorted: gamesWon DESC, winRate DESC, gamesPlayed DESC, userId ASC.
   */
  private aggregateWindowed(cutoff: Date): Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
  }> {
    const cutoffMs = cutoff.getTime();
    // Collect game_players rows whose game ended_at >= cutoff and game is not abandoned.
    const byUser = new Map<string, { gamesPlayed: number; gamesWon: number; gamesLost: number }>();
    for (const gp of this.gamePlayers.values()) {
      if (gp.userId === null) continue;
      const user = this.users.get(gp.userId);
      if (!user || user.isGuest) continue;
      const game = this.games.get(gp.gameId);
      if (!game || game.endedAt === null || game.endedAt.getTime() < cutoffMs) continue;
      if (game.isAbandoned) continue;

      const agg = byUser.get(gp.userId) ?? { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 };
      agg.gamesPlayed += 1;
      if (gp.result === 'WIN') agg.gamesWon += 1;
      if (gp.result === 'LOSS') agg.gamesLost += 1;
      byUser.set(gp.userId, agg);
    }

    const rows = [...byUser.entries()]
      .filter(([, agg]) => agg.gamesPlayed > 0)
      .map(([userId, agg]) => {
        const user = this.users.get(userId)!;
        return {
          userId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          gamesPlayed: agg.gamesPlayed,
          gamesWon: agg.gamesWon,
          gamesLost: agg.gamesLost,
        };
      });

    rows.sort((a, b) => {
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const wrA = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
      const wrB = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
      if (wrB !== wrA) return wrB - wrA;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    });

    return rows;
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
