import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GameEvent, Move, PlayerView } from '@ganatri/engine';
import {
  createRoom as netCreateRoom,
  joinRoom as netJoinRoom,
  leaveRoom as netLeaveRoom,
  makeMove as netMakeMove,
  requestState,
  requestHistory as netRequestHistory,
  requestMyStats as netRequestMyStats,
  getMyProgression as netGetMyProgression,
  getMyScoreHistory as netGetMyScoreHistory,
  requestLeaderboard as netRequestLeaderboard,
  loginWithGoogle as netLoginWithGoogle,
  logout as netLogout,
  clearGuestToken,
  clearAuthSessionToken,
  clearRuntimeSessionStorage,
  getAuthSessions as netGetAuthSessions,
  revokeAuthSession as netRevokeAuthSession,
  revokeOtherAuthSessions as netRevokeOtherAuthSessions,
  setGuestToken,
  setPlayerId,
  socket,
  startGame as netStartGame,
  updateDisplayName as netUpdateDisplayName,
  requestRecentPlayers as netRequestRecentPlayers,
  invitePlayer as netInvitePlayer,
  respondToInvite as netRespondToInvite,
  blockUser as netBlockUser,
  unblockUser as netUnblockUser,
  getBlockedUsers as netGetBlockedUsers,
  deleteAccount as netDeleteAccount,
  downloadMyData as netDownloadMyData,
} from '../net/socket';
import {
  EVENTS,
  type CreateRoomAck,
  type GameEventPayload,
  type JoinRoomAck,
  type PlayerDisconnectedPayload,
  type PlayerReconnectedPayload,
  type RequestHistoryAck,
  type GetMyStatsAck,
  type GetMyProgressionAck,
  type GetMyScoreHistoryAck,
  type GetLeaderboardAck,
  type UpdateDisplayNameAck,
  type RoomUpdatePayload,
  type SessionPayload,
  type StartGameAck,
  type StateUpdatePayload,
  type CoPlayerView,
  type MatchScoringView,
  type PlayerProgressionView,
  type ScoreHistoryEntryView,
  type InviteReceivedPayload,
  type InviteAcceptedPayload,
  type InviteCancelledPayload,
  type PlayerOnlineStatusPayload,
  type InvitePlayerAck,
  type RespondToInviteAck,
  type BlockUserAck,
  type UnblockUserAck,
  type GetBlockedUsersAck,
  type DeleteAccountAck,
  type DownloadMyDataAck,
  type GetAuthSessionsAck,
  type RevokeAuthSessionAck,
  type RevokeOtherAuthSessionsAck,
} from '../protocol';

export interface SessionInfo {
  playerId: string;
  guestToken?: string;
}

export interface AccountInfo {
  loggedIn: boolean;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

export interface LoggedEvent {
  id: number;
  event: GameEvent;
}

export interface GameContextValue {
  connected: boolean;
  session: SessionInfo | null;
  account: AccountInfo | null;
  room: RoomUpdatePayload | null;
  view: PlayerView | null;
  turnStartedAt: number | null;
  turnTimeoutMs: number;
  eventLog: readonly LoggedEvent[];
  lastEvent: GameEvent | null;
  disconnectedPlayers: ReadonlySet<string>;
  /** playerId → display name, sourced from room updates */
  playerNames: Readonly<Record<string, string>>;
  /** playerId → avatar URL, or null for guests */
  playerAvatarUrls: Readonly<Record<string, string | null>>;
  /** Guest display name restored from a previous session (null for logged-in users or first-time guests). */
  guestName: string | null;
  /** Recently played co-players for the logged-in user (null while loading). */
  recentPlayers: CoPlayerView[] | null;
  progression: PlayerProgressionView | null;
  progressionLoading: boolean;
  progressionError: string | null;
  scoreHistory: ScoreHistoryEntryView[];
  latestMatchScoring: MatchScoringView[];
  /** A pending invite this player has received, or null. */
  pendingInvite: InviteReceivedPayload | null;
  error: string | null;
  clearError: () => void;
  createRoom: (name?: string) => Promise<CreateRoomAck>;
  joinRoom: (roomCode: string, name?: string) => Promise<JoinRoomAck>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<StartGameAck>;
  makeMove: (move: Move) => Promise<boolean>;
  /** Lightweight in-app navigation for non-game screens (e.g. history). */
  screen: 'main' | 'history' | 'stats' | 'leaderboard' | 'sessions';
  setScreen: (screen: 'main' | 'history' | 'stats' | 'leaderboard' | 'sessions') => void;
  requestHistory: () => Promise<RequestHistoryAck>;
  requestMyStats: () => Promise<GetMyStatsAck>;
  getMyProgression: () => Promise<GetMyProgressionAck>;
  getMyScoreHistory: () => Promise<GetMyScoreHistoryAck>;
  requestLeaderboard: (timeWindow?: 'week' | 'month') => Promise<GetLeaderboardAck>;
  updateDisplayName: (newName: string) => Promise<UpdateDisplayNameAck>;
  loginWithGoogle: () => void;
  logout: () => void;
  invitePlayer: (targetUserId: string) => Promise<InvitePlayerAck>;
  respondToInvite: (inviterUserId: string, accept: boolean, block?: boolean) => Promise<RespondToInviteAck>;
  blockUser: (targetUserId: string) => Promise<BlockUserAck>;
  unblockUser: (targetUserId: string) => Promise<UnblockUserAck>;
  getBlockedUsers: () => Promise<GetBlockedUsersAck>;
  getAuthSessions: () => Promise<GetAuthSessionsAck>;
  revokeAuthSession: (sessionId: string) => Promise<RevokeAuthSessionAck>;
  revokeOtherAuthSessions: () => Promise<RevokeOtherAuthSessionsAck>;
  deleteAccount: () => Promise<DeleteAccountAck>;
  downloadMyData: () => Promise<DownloadMyDataAck>;
  refreshRecentPlayers: () => Promise<void>;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }): ReactNode {
  const [connected, setConnected] = useState(socket.connected);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [screen, setScreen] = useState<'main' | 'history' | 'stats' | 'leaderboard' | 'sessions'>('main');
  const [room, setRoom] = useState<RoomUpdatePayload | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [turnTimeoutMs, setTurnTimeoutMs] = useState(10_000);
  const [eventLog, setEventLog] = useState<LoggedEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [playerAvatarUrls, setPlayerAvatarUrls] = useState<Record<string, string | null>>({});
  const [guestName, setGuestName] = useState<string | null>(null);
  const [recentPlayers, setRecentPlayers] = useState<CoPlayerView[] | null>(null);
  const [progression, setProgression] = useState<PlayerProgressionView | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntryView[]>([]);
  const [latestMatchScoring, setLatestMatchScoring] = useState<MatchScoringView[]>([]);
  const [pendingInvite, setPendingInvite] = useState<InviteReceivedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventId = useRef(0);
  const roomPhaseRef = useRef<RoomUpdatePayload['phase'] | null>(null);
  // Refs for the trick-reveal freeze: keep the board visible for a beat after
  // TRICK_WON / CUT before applying the cleared-trick STATE_UPDATE.
  const viewRef = useRef(view);
  viewRef.current = view;
  const turnTimeoutMsRef = useRef(turnTimeoutMs);
  turnTimeoutMsRef.current = turnTimeoutMs;
  const trickFreezeUntilRef = useRef<number>(0);
  const pendingStateUpdateRef = useRef<StateUpdatePayload | null>(null);
  const trickFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onConnect(): void {
      setConnected(true);
    }
    function onDisconnect(): void {
      setConnected(false);
    }
    function onSession(payload: SessionPayload): void {
      if (payload.loggedIn) {
        clearGuestToken();
        clearAuthSessionToken();
      } else if (payload.guestToken) {
        setGuestToken(payload.guestToken);
      }
      setPlayerId(payload.playerId);
      setSession({
        playerId: payload.playerId,
        ...(payload.guestToken ? { guestToken: payload.guestToken } : {}),
      });
      setAccount({
        loggedIn: payload.loggedIn,
        displayName: payload.displayName,
        email: payload.email,
        avatarUrl: payload.avatarUrl,
      });
      // Restore guest name from a previous session (logged-in users use account.displayName)
      if (!payload.loggedIn && payload.name) {
        setGuestName(payload.name);
      } else if (payload.loggedIn) {
        setGuestName(null);
      }
      // Restore mid-game view on (re)connect.
      void requestState().then((ack) => {
        if (ack.view) setView(ack.view);
      });
    }
    function onRoomUpdate(payload: RoomUpdatePayload): void {
      const prevPhase = roomPhaseRef.current;
      roomPhaseRef.current = payload.phase;
      setRoom(payload);
      setDisconnectedPlayers(new Set(payload.disconnectedPlayers));
      if (payload.playerNames) setPlayerNames(payload.playerNames);
      if (payload.playerAvatarUrls) setPlayerAvatarUrls(payload.playerAvatarUrls);
      if (payload.phase === 'LOBBY') {
        // Cancel any active trick freeze so stale pending updates don't bleed
        // into the next game.
        if (trickFreezeTimerRef.current !== null) {
          clearTimeout(trickFreezeTimerRef.current);
          trickFreezeTimerRef.current = null;
        }
        trickFreezeUntilRef.current = 0;
        pendingStateUpdateRef.current = null;
        setView(null);
        setEventLog([]);
        setLastEvent(null);
        setLatestMatchScoring([]);
      } else if (payload.phase === 'PLAYING' && prevPhase !== 'PLAYING') {
        // Fresh game only — not on disconnect/reconnect room updates mid-play.
        setEventLog([]);
        setLastEvent(null);
        setLatestMatchScoring([]);
      }
    }
    function onGameEvent(payload: GameEventPayload): void {
      const logged: LoggedEvent = { id: eventId.current++, event: payload.event };
      setEventLog((log) => [...log.slice(-49), logged]);
      setLastEvent(payload.event);

      // Optimistically show the played card in the trick area immediately in
      // Part 2. Without this, other players see a gap between CARD_PLAYED and
      // the STATE_UPDATE that carries the official trick state.
      if (payload.event.type === 'CARD_PLAYED' && viewRef.current?.phase === 'PART_2') {
        const { player, card } = payload.event;
        setView((prev) => {
          if (!prev || prev.phase !== 'PART_2') return prev;
          // Guard against duplicates if the STATE_UPDATE arrives first.
          if (prev.trick.some((tp) => tp.player === player)) return prev;
          return { ...prev, trick: [...prev.trick, { player, card, isCut: false }] };
        });
      }

      // After a trick resolves (TRICK_WON) or is cut, freeze the view for a
      // short window so all players can see the completed trick before the board
      // clears. The queued STATE_UPDATE is applied once the freeze expires.
      if (payload.event.type === 'TRICK_WON' || payload.event.type === 'CUT') {
        const freezeMs = payload.event.type === 'TRICK_WON' ? 2200 : 2000;
        trickFreezeUntilRef.current = Date.now() + freezeMs;
        if (trickFreezeTimerRef.current !== null) clearTimeout(trickFreezeTimerRef.current);
        trickFreezeTimerRef.current = setTimeout(() => {
          trickFreezeTimerRef.current = null;
          trickFreezeUntilRef.current = 0;
          const pending = pendingStateUpdateRef.current;
          if (pending !== null) {
            pendingStateUpdateRef.current = null;
            setView(pending.view);
            setTurnStartedAt(pending.turnStartedAt ?? null);
            setTurnTimeoutMs(pending.turnTimeoutMs);
            setLatestMatchScoring(pending.matchScoring ?? []);
          }
        }, freezeMs);
      }
    }
    function onStateUpdate(payload: StateUpdatePayload): void {
      if (Date.now() < trickFreezeUntilRef.current) {
        // Trick freeze is active — hold the update until the freeze expires.
        pendingStateUpdateRef.current = payload;
        return;
      }
      setView(payload.view);
      setTurnStartedAt(payload.turnStartedAt ?? null);
      setTurnTimeoutMs(payload.turnTimeoutMs);
      setLatestMatchScoring(payload.matchScoring ?? []);
    }
    function onPlayerDisconnected(payload: PlayerDisconnectedPayload): void {
      setDisconnectedPlayers((prev) => {
        const next = new Set(prev);
        next.add(payload.playerId);
        return next;
      });
    }
    function onPlayerReconnected(payload: PlayerReconnectedPayload): void {
      setDisconnectedPlayers((prev) => {
        if (!prev.has(payload.playerId)) return prev;
        const next = new Set(prev);
        next.delete(payload.playerId);
        return next;
      });
    }
    function onInviteReceived(payload: InviteReceivedPayload): void {
      setPendingInvite(payload);
    }
    function onInviteCancelled(payload: InviteCancelledPayload): void {
      setPendingInvite((prev) =>
        prev?.inviterUserId === payload.inviterUserId ? null : prev,
      );
    }
    function onInviteAccepted(_payload: InviteAcceptedPayload): void {
      setPendingInvite(null);
    }
    function onPlayerOnlineStatus(payload: PlayerOnlineStatusPayload): void {
      setRecentPlayers((prev) =>
        prev ? prev.map((p) => (p.userId === payload.userId ? { ...p, isOnline: payload.isOnline } : p)) : prev,
      );
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(EVENTS.SESSION, onSession);
    socket.on(EVENTS.ROOM_UPDATE, onRoomUpdate);
    socket.on(EVENTS.GAME_EVENT, onGameEvent);
    socket.on(EVENTS.STATE_UPDATE, onStateUpdate);
    socket.on(EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
    socket.on(EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);
    socket.on(EVENTS.INVITE_RECEIVED, onInviteReceived);
    socket.on(EVENTS.INVITE_CANCELLED, onInviteCancelled);
    socket.on(EVENTS.INVITE_ACCEPTED, onInviteAccepted);
    socket.on(EVENTS.PLAYER_ONLINE_STATUS, onPlayerOnlineStatus);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(EVENTS.SESSION, onSession);
      socket.off(EVENTS.ROOM_UPDATE, onRoomUpdate);
      socket.off(EVENTS.GAME_EVENT, onGameEvent);
      socket.off(EVENTS.STATE_UPDATE, onStateUpdate);
      socket.off(EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
      socket.off(EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);
      socket.off(EVENTS.INVITE_RECEIVED, onInviteReceived);
      socket.off(EVENTS.INVITE_CANCELLED, onInviteCancelled);
      socket.off(EVENTS.INVITE_ACCEPTED, onInviteAccepted);
      socket.off(EVENTS.PLAYER_ONLINE_STATUS, onPlayerOnlineStatus);
      if (trickFreezeTimerRef.current !== null) {
        clearTimeout(trickFreezeTimerRef.current);
        trickFreezeTimerRef.current = null;
      }
    };
  }, []);

  // Auto-fetch recent players when the user transitions to logged-in.
  useEffect(() => {
    if (!account?.loggedIn) return;
    void netRequestRecentPlayers().then((ack) => {
      if (ack.ok) setRecentPlayers(ack.players);
    });
    setProgressionLoading(true);
    setProgressionError(null);
    void netGetMyProgression().then((ack) => {
      setProgressionLoading(false);
      if (ack.ok) setProgression(ack.progression);
      else setProgressionError(ack.error);
    });
    void netGetMyScoreHistory().then((ack) => {
      if (ack.ok) setScoreHistory(ack.history);
    });
  }, [account?.loggedIn]);

  const clearError = useCallback(() => setError(null), []);

  const requestHistory = useCallback(() => netRequestHistory(), []);
  const requestMyStats = useCallback(() => netRequestMyStats(), []);
  const getMyProgression = useCallback(() => netGetMyProgression(), []);
  const getMyScoreHistory = useCallback(() => netGetMyScoreHistory(), []);
  const requestLeaderboard = useCallback((timeWindow?: 'week' | 'month') => netRequestLeaderboard(timeWindow), []);
  const updateDisplayName = useCallback((newName: string) => netUpdateDisplayName(newName), []);
  const loginWithGoogle = useCallback(() => netLoginWithGoogle(), []);
  const logout = useCallback(() => netLogout(), []);

  const invitePlayer = useCallback((targetUserId: string) => netInvitePlayer(targetUserId), []);
  const respondToInvite = useCallback(
    async (inviterUserId: string, accept: boolean, block?: boolean): Promise<RespondToInviteAck> => {
      const ack = await netRespondToInvite(inviterUserId, accept, block);
      if (ack.ok) setPendingInvite(null);
      return ack;
    },
    [],
  );
  const blockUser = useCallback((targetUserId: string) => netBlockUser(targetUserId), []);
  const unblockUser = useCallback((targetUserId: string) => netUnblockUser(targetUserId), []);
  const getBlockedUsers = useCallback(() => netGetBlockedUsers(), []);
  const getAuthSessions = useCallback(() => netGetAuthSessions(), []);
  const revokeAuthSession = useCallback(
    async (sessionId: string): Promise<RevokeAuthSessionAck> => {
      const ack = await netRevokeAuthSession(sessionId);
      if (ack.ok && ack.revokedCurrent) {
        netLogout();
      }
      return ack;
    },
    [],
  );
  const revokeOtherAuthSessions = useCallback(() => netRevokeOtherAuthSessions(), []);
  const deleteAccount = useCallback(async (): Promise<DeleteAccountAck> => {
    const ack = await netDeleteAccount();
    if (ack.ok) {
      clearRuntimeSessionStorage();
      setScreen('main');
      socket.disconnect().connect();
    }
    return ack;
  }, []);
  const downloadMyData = useCallback(() => netDownloadMyData(), []);
  const refreshRecentPlayers = useCallback(async () => {
    const ack = await netRequestRecentPlayers();
    if (ack.ok) setRecentPlayers(ack.players);
  }, []);

  const createRoom = useCallback((name?: string) => netCreateRoom(name), []);
  const joinRoom = useCallback((roomCode: string, name?: string) => netJoinRoom(roomCode, name), []);
  const startGame = useCallback(() => netStartGame(), []);

  const leaveRoom = useCallback(async () => {
    await netLeaveRoom();
    setRoom(null);
    setView(null);
    setTurnStartedAt(null);
    setEventLog([]);
    setLastEvent(null);
    setDisconnectedPlayers(new Set());
    setPlayerNames({});
    setPlayerAvatarUrls({});
  }, []);

  const makeMove = useCallback(async (move: Move): Promise<boolean> => {
    const ack = await netMakeMove(move);
    if (ack.ok) {
      if (Date.now() < trickFreezeUntilRef.current) {
        // The ack arrives after TRICK_WON/CUT set the freeze. Queue the view
        // so the trick stays visible until the freeze expires.
        pendingStateUpdateRef.current = {
          view: ack.view,
          turnStartedAt: ack.turnStartedAt,
          turnTimeoutMs: turnTimeoutMsRef.current,
          matchScoring: ack.matchScoring,
        };
      } else {
        setView(ack.view);
        setTurnStartedAt(ack.turnStartedAt);
        setLatestMatchScoring(ack.matchScoring ?? []);
      }
      return true;
    }
    setError(ack.message || ack.error);
    return false;
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      session,
      account,
      room,
      view,
      turnStartedAt,
      turnTimeoutMs,
      eventLog,
      lastEvent,
      disconnectedPlayers,
      playerNames,
      playerAvatarUrls,
      guestName,
      recentPlayers,
      progression,
      progressionLoading,
      progressionError,
      scoreHistory,
      latestMatchScoring,
      pendingInvite,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      makeMove,
      screen,
      setScreen,
      requestHistory,
      requestMyStats,
      getMyProgression,
      getMyScoreHistory,
      requestLeaderboard,
      updateDisplayName,
      loginWithGoogle,
      logout,
      invitePlayer,
      respondToInvite,
      blockUser,
      unblockUser,
      getBlockedUsers,
      getAuthSessions,
      revokeAuthSession,
      revokeOtherAuthSessions,
      deleteAccount,
      downloadMyData,
      refreshRecentPlayers,
    }),
    [
      connected,
      session,
      account,
      room,
      view,
      turnStartedAt,
      turnTimeoutMs,
      eventLog,
      lastEvent,
      disconnectedPlayers,
      playerNames,
      playerAvatarUrls,
      guestName,
      recentPlayers,
      progression,
      progressionLoading,
      progressionError,
      scoreHistory,
      latestMatchScoring,
      pendingInvite,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      makeMove,
      screen,
      requestHistory,
      requestMyStats,
      getMyProgression,
      getMyScoreHistory,
      requestLeaderboard,
      updateDisplayName,
      loginWithGoogle,
      logout,
      invitePlayer,
      respondToInvite,
      blockUser,
      unblockUser,
      getBlockedUsers,
      getAuthSessions,
      revokeAuthSession,
      revokeOtherAuthSessions,
      deleteAccount,
      downloadMyData,
      refreshRecentPlayers,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
