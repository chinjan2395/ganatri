/**
 * auth/oauth.ts — thin wrapper around google-auth-library's OAuth2Client.
 *
 * Only constructs the client when OAuth env vars are present; callers should
 * gate on `isOAuthEnabled()` before invoking these.
 */

import { OAuth2Client } from 'google-auth-library';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  OAUTH_REDIRECT_URI,
} from '../config.js';

const SCOPES = ['openid', 'email', 'profile'];

/** Resolved profile fields after a successful code exchange. */
export interface GoogleProfile {
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

function client(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: OAUTH_REDIRECT_URI,
  });
}

/** Build the Google consent-screen URL for the given CSRF state token. */
export function getGoogleAuthUrl(state: string): string {
  return client().generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  });
}

/**
 * Exchange an authorization code for tokens, verify the id_token, and extract
 * the federated identity. Throws if the code is invalid or no id_token / sub.
 */
export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const oauth = client();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.id_token) {
    throw new Error('Google token response missing id_token');
  }
  const ticket = await oauth.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error('Google id_token payload missing sub');
  }
  // Only trust the email for account-linking when Google says it's verified.
  // An unverified email must not feed the db's email-linking branch, else a
  // claim-by-unverified-email account-takeover vector opens up.
  const verifiedEmail = payload.email_verified === true ? (payload.email ?? null) : null;
  return {
    providerUserId: payload.sub,
    email: verifiedEmail,
    displayName: payload.name ?? verifiedEmail ?? 'Player',
    avatarUrl: payload.picture ?? null,
  };
}
