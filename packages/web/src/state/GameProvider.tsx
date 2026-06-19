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
  loginWithGoogle as netLoginWithGoogle,
  logout as netLogout,
  setToken,
  socket,
  startGame as netStartGame,
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
  type RoomUpdatePayload,
  type SessionPayload,
  type StartGameAck,
  type StateUpdatePayload,
} from '../protocol';

export interface SessionInfo {
  token: string;
  playerId: string;
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
  error: string | null;
  clearError: () => void;
  createRoom: (name?: string) => Promise<CreateRoomAck>;
  joinRoom: (roomCode: string, name?: string) => Promise<JoinRoomAck>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<StartGameAck>;
  makeMove: (move: Move) => Promise<boolean>;
  /** Lightweight in-app navigation for non-game screens (e.g. history). */
  screen: 'main' | 'history' | 'stats';
  setScreen: (screen: 'main' | 'history' | 'stats') => void;
  requestHistory: () => Promise<RequestHistoryAck>;
  requestMyStats: () => Promise<GetMyStatsAck>;
  loginWithGoogle: () => void;
  logout: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }): ReactNode {
  const [connected, setConnected] = useState(socket.connected);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [screen, setScreen] = useState<'main' | 'history' | 'stats'>('main');
  const [room, setRoom] = useState<RoomUpdatePayload | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [turnTimeoutMs, setTurnTimeoutMs] = useState(10_000);
  const [eventLog, setEventLog] = useState<LoggedEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
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
      setToken(payload.token);
      setSession({ token: payload.token, playerId: payload.playerId });
      setAccount({
        loggedIn: payload.loggedIn,
        displayName: payload.displayName,
        email: payload.email,
        avatarUrl: payload.avatarUrl,
      });
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
      } else if (payload.phase === 'PLAYING' && prevPhase !== 'PLAYING') {
        // Fresh game only — not on disconnect/reconnect room updates mid-play.
        setEventLog([]);
        setLastEvent(null);
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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(EVENTS.SESSION, onSession);
    socket.on(EVENTS.ROOM_UPDATE, onRoomUpdate);
    socket.on(EVENTS.GAME_EVENT, onGameEvent);
    socket.on(EVENTS.STATE_UPDATE, onStateUpdate);
    socket.on(EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
    socket.on(EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(EVENTS.SESSION, onSession);
      socket.off(EVENTS.ROOM_UPDATE, onRoomUpdate);
      socket.off(EVENTS.GAME_EVENT, onGameEvent);
      socket.off(EVENTS.STATE_UPDATE, onStateUpdate);
      socket.off(EVENTS.PLAYER_DISCONNECTED, onPlayerDisconnected);
      socket.off(EVENTS.PLAYER_RECONNECTED, onPlayerReconnected);
      if (trickFreezeTimerRef.current !== null) {
        clearTimeout(trickFreezeTimerRef.current);
        trickFreezeTimerRef.current = null;
      }
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const requestHistory = useCallback(() => netRequestHistory(), []);
  const requestMyStats = useCallback(() => netRequestMyStats(), []);
  const loginWithGoogle = useCallback(() => netLoginWithGoogle(), []);
  const logout = useCallback(() => netLogout(), []);

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
        };
      } else {
        setView(ack.view);
        setTurnStartedAt(ack.turnStartedAt);
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
      loginWithGoogle,
      logout,
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
      loginWithGoogle,
      logout,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
