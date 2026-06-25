/**
 * Singleton socket.io client + typed promise wrappers for every client→server
 * intent. All socket access is funnelled through this module and the provider.
 */

import { io, type Socket } from 'socket.io-client';
import type { Move } from '@ganatri/engine';
import {
  EVENTS,
  type AuthSessionView,
  type CreateRoomAck,
  type CreateRoomPayload,
  type GetAuthSessionsAck,
  type JoinRoomAck,
  type JoinRoomPayload,
  type LeaveRoomAck,
  type MakeMoveAck,
  type MakeMovePayload,
  type RequestStateAck,
  type RequestHistoryAck,
  type GetMyStatsAck,
  type GetMyProgressionAck,
  type GetMyScoreHistoryAck,
  type GetLeaderboardAck,
  type GetLeaderboardRequest,
  type RequestIceServersAck,
  type StartGameAck,
  type UpdateDisplayNameAck,
  type GetRecentPlayersAck,
  type InvitePlayerAck,
  type RevokeAuthSessionAck,
  type RevokeAuthSessionPayload,
  type RevokeOtherAuthSessionsAck,
  type RespondToInviteAck,
  type BlockUserAck,
  type UnblockUserAck,
  type GetBlockedUsersAck,
  type DeleteAccountAck,
  type DownloadMyDataAck,
} from '../protocol';

const LEGACY_TOKEN_KEY = 'ganatri.token';
const AUTH_SESSION_TOKEN_KEY = 'ganatri.authSessionToken';
const GUEST_TOKEN_KEY = 'ganatri.guestToken';
const PLAYER_ID_KEY = 'ganatri.playerId';
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

function syncSocketAuth(): void {
  socket.auth = {
    ...socket.auth as object,
    guestToken: getGuestToken() ?? undefined,
    playerId: getPlayerId() ?? undefined,
    authSessionToken: getAuthSessionToken() ?? undefined,
  };
}

export function getAuthSessionToken(): string | null {
  return sessionStorage.getItem(AUTH_SESSION_TOKEN_KEY);
}

export function setAuthSessionToken(token: string): void {
  sessionStorage.setItem(AUTH_SESSION_TOKEN_KEY, token);
  syncSocketAuth();
}

export function clearAuthSessionToken(): void {
  sessionStorage.removeItem(AUTH_SESSION_TOKEN_KEY);
  syncSocketAuth();
}

/** Capture the post-OAuth token from the URL before bootstrap runs. */
export function captureAuthTokenFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const authToken = params.get('auth_token');
  if (!authToken) return;

  setAuthSessionToken(authToken);
  localStorage.setItem(LEGACY_TOKEN_KEY, authToken);
  const nextUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

export function getLegacyToken(): string | null {
  return localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function clearLegacyToken(): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getGuestToken(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function setGuestToken(token: string): void {
  localStorage.setItem(GUEST_TOKEN_KEY, token);
  syncSocketAuth();
}

export function clearGuestToken(): void {
  localStorage.removeItem(GUEST_TOKEN_KEY);
  syncSocketAuth();
}

export function getPlayerId(): string | null {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function setPlayerId(playerId: string): void {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
  syncSocketAuth();
}

export function clearPlayerId(): void {
  localStorage.removeItem(PLAYER_ID_KEY);
  syncSocketAuth();
}

export function clearRuntimeSessionStorage(): void {
  localStorage.removeItem(GUEST_TOKEN_KEY);
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  clearAuthSessionToken();
  syncSocketAuth();
}

type BootstrapResponse =
  | { kind: 'auth' }
  | { kind: 'guest'; guestToken: string; playerId: string }
  | { kind: 'none' };

export async function bootstrapAuth(): Promise<void> {
  const legacyToken = getLegacyToken() ?? getAuthSessionToken();

  try {
    const response = await fetch(`${SERVER_URL}/auth/bootstrap`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacyToken ? { legacyToken } : {}),
    });
    if (!response.ok) {
      syncSocketAuth();
      return;
    }

    const payload = await response.json() as BootstrapResponse;
    if (payload.kind === 'auth') {
      clearLegacyToken();
      clearGuestToken();
      return;
    }
    if (payload.kind === 'guest') {
      setGuestToken(payload.guestToken);
      setPlayerId(payload.playerId);
      clearLegacyToken();
      clearAuthSessionToken();
      return;
    }

    clearLegacyToken();
  } catch {
    // Keep any authSessionToken so the socket handshake can still authenticate.
  } finally {
    syncSocketAuth();
  }
}

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: {
    guestToken: getGuestToken() ?? undefined,
    playerId: getPlayerId() ?? undefined,
    authSessionToken: getAuthSessionToken() ?? undefined,
  },
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

export function getMyProgression(): Promise<GetMyProgressionAck> {
  return emitAck<GetMyProgressionAck>(EVENTS.GET_MY_PROGRESSION);
}

export function getMyScoreHistory(): Promise<GetMyScoreHistoryAck> {
  return emitAck<GetMyScoreHistoryAck>(EVENTS.GET_MY_SCORE_HISTORY);
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
  const guestToken = getGuestToken();
  const url = guestToken
    ? `${SERVER_URL}/auth/google/login?session_token=${encodeURIComponent(guestToken)}`
    : `${SERVER_URL}/auth/google/login`;
  window.location.assign(url);
}

/** Full-page navigation to clear the server session cookie. */
export function logout(): void {
  clearRuntimeSessionStorage();
  window.location.assign(`${SERVER_URL}/auth/logout`);
}

export function requestIceServers(): Promise<RequestIceServersAck> {
  return emitAck<RequestIceServersAck>(EVENTS.VOICE_ICE_SERVERS);
}

export function updateDisplayName(newDisplayName: string): Promise<UpdateDisplayNameAck> {
  return emitAck<UpdateDisplayNameAck>(EVENTS.UPDATE_DISPLAY_NAME, { newDisplayName });
}

export function requestRecentPlayers(): Promise<GetRecentPlayersAck> {
  return emitAck<GetRecentPlayersAck>(EVENTS.GET_RECENT_PLAYERS);
}

export function invitePlayer(targetUserId: string): Promise<InvitePlayerAck> {
  return emitAck<InvitePlayerAck>(EVENTS.INVITE_PLAYER, { targetUserId });
}

export function respondToInvite(
  inviterUserId: string,
  accept: boolean,
  block?: boolean,
): Promise<RespondToInviteAck> {
  return emitAck<RespondToInviteAck>(EVENTS.RESPOND_TO_INVITE, { inviterUserId, accept, block });
}

export function blockUser(targetUserId: string): Promise<BlockUserAck> {
  return emitAck<BlockUserAck>(EVENTS.BLOCK_USER, { targetUserId });
}

export function unblockUser(targetUserId: string): Promise<UnblockUserAck> {
  return emitAck<UnblockUserAck>(EVENTS.UNBLOCK_USER, { targetUserId });
}

export function getBlockedUsers(): Promise<GetBlockedUsersAck> {
  return emitAck<GetBlockedUsersAck>(EVENTS.GET_BLOCKED_USERS);
}

export function getAuthSessions(): Promise<GetAuthSessionsAck> {
  return emitAck<GetAuthSessionsAck>(EVENTS.GET_AUTH_SESSIONS);
}

export function revokeAuthSession(sessionId: string): Promise<RevokeAuthSessionAck> {
  const payload: RevokeAuthSessionPayload = { sessionId };
  return emitAck<RevokeAuthSessionAck>(EVENTS.REVOKE_AUTH_SESSION, payload);
}

export function revokeOtherAuthSessions(): Promise<RevokeOtherAuthSessionsAck> {
  return emitAck<RevokeOtherAuthSessionsAck>(EVENTS.REVOKE_OTHER_AUTH_SESSIONS);
}

export function deleteAccount(): Promise<DeleteAccountAck> {
  return emitAck<DeleteAccountAck>(EVENTS.DELETE_ACCOUNT);
}

export function downloadMyData(): Promise<DownloadMyDataAck> {
  return emitAck<DownloadMyDataAck>(EVENTS.DOWNLOAD_MY_DATA);
}
