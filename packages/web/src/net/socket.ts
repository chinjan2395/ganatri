/**
 * Singleton socket.io client + typed promise wrappers for every client→server
 * intent. All socket access is funnelled through this module and the provider.
 */

import { io, type Socket } from 'socket.io-client';
import type { Move } from '@ganatri/engine';
import {
  EVENTS,
  type CreateRoomAck,
  type CreateRoomPayload,
  type JoinRoomAck,
  type JoinRoomPayload,
  type LeaveRoomAck,
  type MakeMoveAck,
  type MakeMovePayload,
  type RequestStateAck,
  type RequestHistoryAck,
  type GetMyStatsAck,
  type GetLeaderboardAck,
  type GetLeaderboardRequest,
  type RequestIceServersAck,
  type StartGameAck,
  type UpdateDisplayNameAck,
} from '../protocol';

const TOKEN_KEY = 'ganatri.token';
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Keep the handshake auth in sync for the next (re)connect.
  socket.auth = { token };
}

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  withCredentials: true,
  auth: { token: getToken() ?? undefined },
  transports: ['websocket', 'polling'],
});

function emitAck<T>(event: string, payload?: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    if (payload === undefined) {
      socket.emit(event, (ack: T) => resolve(ack));
    } else {
      socket.emit(event, payload, (ack: T) => resolve(ack));
    }
  });
}

export function createRoom(name?: string): Promise<CreateRoomAck> {
  const payload: CreateRoomPayload = { name };
  return emitAck<CreateRoomAck>(EVENTS.CREATE_ROOM, payload);
}

export function joinRoom(roomCode: string, name?: string): Promise<JoinRoomAck> {
  const payload: JoinRoomPayload = { roomCode, name };
  return emitAck<JoinRoomAck>(EVENTS.JOIN_ROOM, payload);
}

export function leaveRoom(): Promise<LeaveRoomAck> {
  return emitAck<LeaveRoomAck>(EVENTS.LEAVE_ROOM);
}

export function startGame(): Promise<StartGameAck> {
  return emitAck<StartGameAck>(EVENTS.START_GAME);
}

export function makeMove(move: Move): Promise<MakeMoveAck> {
  const payload: MakeMovePayload = { move };
  return emitAck<MakeMoveAck>(EVENTS.MAKE_MOVE, payload);
}

export function requestState(): Promise<RequestStateAck> {
  return emitAck<RequestStateAck>(EVENTS.REQUEST_STATE);
}

export function requestHistory(): Promise<RequestHistoryAck> {
  return emitAck<RequestHistoryAck>(EVENTS.REQUEST_HISTORY);
}

export function requestMyStats(): Promise<GetMyStatsAck> {
  return emitAck<GetMyStatsAck>(EVENTS.GET_MY_STATS);
}

export function requestLeaderboard(timeWindow?: 'week' | 'month'): Promise<GetLeaderboardAck> {
  const payload: GetLeaderboardRequest = { timeWindow };
  return emitAck<GetLeaderboardAck>(EVENTS.GET_LEADERBOARD, payload);
}

/** Full-page navigation to the server's Google OAuth entry point so the
 *  httpOnly session cookie round-trips through the browser. Passes the
 *  current guest session token so the server can merge guest stats into
 *  the new registered account (Phase 6c guest→registered upgrade). */
export function loginWithGoogle(): void {
  const token = getToken();
  const url = token
    ? `${SERVER_URL}/auth/google/login?session_token=${encodeURIComponent(token)}`
    : `${SERVER_URL}/auth/google/login`;
  window.location.assign(url);
}

/** Full-page navigation to clear the server session cookie. */
export function logout(): void {
  window.location.assign(`${SERVER_URL}/auth/logout`);
}

export function requestIceServers(): Promise<RequestIceServersAck> {
  return emitAck<RequestIceServersAck>(EVENTS.VOICE_ICE_SERVERS);
}

export function updateDisplayName(newDisplayName: string): Promise<UpdateDisplayNameAck> {
  return emitAck<UpdateDisplayNameAck>(EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName });
}
