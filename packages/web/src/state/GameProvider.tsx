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
  type RoomUpdatePayload,
  type SessionPayload,
  type StartGameAck,
  type StateUpdatePayload,
} from '../protocol';

export interface SessionInfo {
  token: string;
  playerId: string;
}

export interface LoggedEvent {
  id: number;
  event: GameEvent;
}

export interface GameContextValue {
  connected: boolean;
  session: SessionInfo | null;
  room: RoomUpdatePayload | null;
  view: PlayerView | null;
  eventLog: readonly LoggedEvent[];
  lastEvent: GameEvent | null;
  disconnectedPlayers: ReadonlySet<string>;
  error: string | null;
  clearError: () => void;
  createRoom: () => Promise<CreateRoomAck>;
  joinRoom: (roomCode: string) => Promise<JoinRoomAck>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<StartGameAck>;
  makeMove: (move: Move) => Promise<boolean>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }): ReactNode {
  const [connected, setConnected] = useState(socket.connected);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [room, setRoom] = useState<RoomUpdatePayload | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [eventLog, setEventLog] = useState<LoggedEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const eventId = useRef(0);

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
      // Restore mid-game view on (re)connect.
      void requestState().then((ack) => {
        if (ack.view) setView(ack.view);
      });
    }
    function onRoomUpdate(payload: RoomUpdatePayload): void {
      setRoom(payload);
      // Always sync disconnected players from the server's authoritative list.
      setDisconnectedPlayers(new Set(payload.disconnectedPlayers));
      if (payload.phase === 'LOBBY') {
        // Returned to lobby; clear stale game state.
        setView(null);
        setEventLog([]);
        setLastEvent(null);
      }
    }
    function onGameEvent(payload: GameEventPayload): void {
      const logged: LoggedEvent = { id: eventId.current++, event: payload.event };
      setEventLog((log) => [...log.slice(-49), logged]);
      setLastEvent(payload.event);
    }
    function onStateUpdate(payload: StateUpdatePayload): void {
      setView(payload.view);
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
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const createRoom = useCallback(() => netCreateRoom(), []);
  const joinRoom = useCallback((roomCode: string) => netJoinRoom(roomCode), []);
  const startGame = useCallback(() => netStartGame(), []);

  const leaveRoom = useCallback(async () => {
    await netLeaveRoom();
    setRoom(null);
    setView(null);
    setEventLog([]);
    setLastEvent(null);
    setDisconnectedPlayers(new Set());
  }, []);

  const makeMove = useCallback(async (move: Move): Promise<boolean> => {
    const ack = await netMakeMove(move);
    if (ack.ok) {
      setView(ack.view);
      return true;
    }
    setError(ack.message || ack.error);
    return false;
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      session,
      room,
      view,
      eventLog,
      lastEvent,
      disconnectedPlayers,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      makeMove,
    }),
    [
      connected,
      session,
      room,
      view,
      eventLog,
      lastEvent,
      disconnectedPlayers,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      makeMove,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
