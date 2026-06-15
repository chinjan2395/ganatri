/**
 * ICE server configuration for WebRTC voice chat.
 *
 * Returns public STUN by default. If Cloudflare Realtime TURN credentials are
 * configured (CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN), this mints
 * short-lived TURN credentials via Cloudflare's API and serves them to clients.
 * The API token stays on the server — clients only ever receive the generated,
 * time-limited username/credential pair.
 *
 * Credentials are cached and shared across clients until shortly before they
 * expire, so the Cloudflare API is hit at most once per TTL window.
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Public STUN — free, no credentials, always included as a cheap fallback.
const DEFAULT_STUN: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];

const TURN_KEY_ID = process.env['CLOUDFLARE_TURN_KEY_ID'] ?? '';
const TURN_API_TOKEN = process.env['CLOUDFLARE_TURN_API_TOKEN'] ?? '';
const TTL_SECONDS = Number(process.env['CLOUDFLARE_TURN_TTL_S'] ?? 3600);
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // regenerate 5 min before expiry
const FETCH_TIMEOUT_MS = 5_000;

let cache: { servers: IceServerConfig[]; expiresAt: number } | null = null;
let inflight: Promise<IceServerConfig[]> | null = null;

/** True when Cloudflare TURN credentials are configured. */
export function turnEnabled(): boolean {
  return Boolean(TURN_KEY_ID && TURN_API_TOKEN);
}

async function generateCredentials(): Promise<IceServerConfig[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
    const data = (await res.json()) as { iceServers?: IceServerConfig | IceServerConfig[] };
    // Cloudflare returns iceServers as a single object; tolerate an array too.
    const ice = data.iceServers;
    const list = Array.isArray(ice) ? ice : ice ? [ice] : [];
    return [...DEFAULT_STUN, ...list];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the ICE servers to hand to clients. STUN-only when TURN isn't
 * configured; otherwise STUN + freshly-minted (or cached) Cloudflare TURN.
 * Never throws — on failure it serves stale credentials or falls back to STUN.
 */
export async function getIceServers(): Promise<IceServerConfig[]> {
  if (!turnEnabled()) return DEFAULT_STUN;

  const now = Date.now();
  if (cache && now < cache.expiresAt - REFRESH_MARGIN_MS) return cache.servers;
  if (inflight) return inflight;

  inflight = generateCredentials()
    .then((servers) => {
      cache = { servers, expiresAt: now + TTL_SECONDS * 1000 };
      return servers;
    })
    .catch((err: unknown) => {
      console.error('[ice] Cloudflare TURN credential fetch failed:', err);
      return cache?.servers ?? DEFAULT_STUN; // serve stale, else STUN
    })
    .finally(() => { inflight = null; });

  return inflight;
}
