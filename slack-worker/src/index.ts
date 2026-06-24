/**
 * Ganatri Slack ↔ GitHub bridge — Cloudflare Worker.
 *
 * Handles the inbound (Slack → GitHub) half of the integration:
 *   1. Slash command  `/ganatri <text>`  → GitHub repository_dispatch
 *      (event_type "slack-add-todo") → .github/workflows/slack-add-todo.yml
 *      formats the text into a priority TODO and commits it.
 *   2. Slash command `/ganatri-phase <text>` → GitHub repository_dispatch
 *      (event_type "slack-add-phase-todo") → .github/workflows/slack-add-phase-todo.yml
 *      formats the text into a phase TODO and commits it.
 *   3. Interactive "▶️ Run now" button   → GitHub workflow_dispatch on
 *      nightly.yml → Claude implements the top queue item.
 *   4. Interactive "Run phase now" button → GitHub workflow_dispatch on
 *      phase-nightly.yml → Claude implements the top phase work item.
 *
 * The outbound (GitHub → Slack) half — start/finish/report-zip messages — lives
 * in the workflows themselves and does not touch this Worker.
 *
 * Secrets (set with `wrangler secret put <NAME>`):
 *   SLACK_SIGNING_SECRET  — Slack app "Signing Secret" (Basic Information page)
 *   GITHUB_TOKEN          — fine-grained PAT, Contents:write + Actions:write
 * Vars (wrangler.toml [vars]):
 *   GITHUB_REPO           — "owner/repo", e.g. "chinjan2395/ganatri"
 *   NIGHTLY_WORKFLOW      — workflow filename to dispatch, e.g. "nightly.yml"
 *   PHASE_NIGHTLY_WORKFLOW — workflow filename to dispatch, e.g. "phase-nightly.yml"
 */

export interface Env {
  SLACK_SIGNING_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  NIGHTLY_WORKFLOW: string;
  PHASE_NIGHTLY_WORKFLOW: string;
}

const encoder = new TextEncoder();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time string comparison to avoid signature timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify the Slack request signature (https://api.slack.com/authentication/verifying-requests-from-slack). */
async function verifySlackSignature(
  request: Request,
  rawBody: string,
  signingSecret: string,
): Promise<boolean> {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`v0:${timestamp}:${rawBody}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(`v0=${hex}`, signature);
}

/** POST to the GitHub REST API. Returns true on the 2xx no-content success codes. */
async function githubDispatch(env: Env, path: string, body: unknown): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ganatri-slack-worker',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`GitHub ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.ok; // dispatch endpoints return 204 No Content on success
}

async function handleSlashCommand(env: Env, params: URLSearchParams): Promise<Response> {
  const text = (params.get('text') ?? '').trim();
  const command = (params.get('command') ?? '').trim();
  const isPhaseCommand = command === '/ganatri-phase';
  if (!text) {
    return jsonResponse({
      response_type: 'ephemeral',
      text: isPhaseCommand
        ? 'Usage: `/ganatri-phase <phase work to build>` - e.g. `/ganatri-phase implement Phase 9 scoring DB layer`'
        : 'Usage: `/ganatri <what to build or fix>` — e.g. `/ganatri leaderboard shows the wrong rank on page 2`',
    });
  }

  const ok = await githubDispatch(env, 'dispatches', {
    event_type: isPhaseCommand ? 'slack-add-phase-todo' : 'slack-add-todo',
    client_payload: { text, user: params.get('user_name') ?? '' },
  });

  return jsonResponse({
    response_type: 'ephemeral',
    text: ok
      ? isPhaseCommand
        ? `📥 Queuing phase work: “${text}”\nClaude will format it into a phase TODO and confirm in the channel shortly.`
        : `📥 Queuing: “${text}”\nClaude will format it into a TODO and confirm in the channel shortly.`
      : '⚠️ Could not reach GitHub. Check the Worker logs / `GITHUB_TOKEN`.',
  });
}

async function handleInteractivity(env: Env, payloadRaw: string): Promise<Response> {
  let payload: any;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return new Response('bad payload', { status: 400 });
  }

  if (payload.type === 'block_actions') {
    const actionId = payload.actions?.[0]?.action_id;
    if (actionId === 'run_now') {
      const ok = await githubDispatch(env, `actions/workflows/${env.NIGHTLY_WORKFLOW}/dispatches`, {
        ref: 'main',
      });
      return jsonResponse({
        replace_original: true,
        text: ok
          ? '🚀 Nightly run dispatched — watch this channel for progress.'
          : '⚠️ Failed to dispatch the run. Check the Worker logs / `GITHUB_TOKEN`.',
      });
    }
    if (actionId === 'run_phase_now') {
      const ok = await githubDispatch(env, `actions/workflows/${env.PHASE_NIGHTLY_WORKFLOW}/dispatches`, {
        ref: 'main',
      });
      return jsonResponse({
        replace_original: true,
        text: ok
          ? '🚀 Phase nightly run dispatched — watch this channel for progress.'
          : '⚠️ Failed to dispatch the phase run. Check the Worker logs / `GITHUB_TOKEN`.',
      });
    }
  }
  // Acknowledge anything else so Slack doesn't show an error.
  return new Response('', { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Simple health check for GET (e.g. browser / uptime monitor).
    if (request.method === 'GET') {
      return new Response('ganatri-slack-worker: ok', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    const rawBody = await request.text();
    if (!(await verifySlackSignature(request, rawBody, env.SLACK_SIGNING_SECRET))) {
      return new Response('invalid signature', { status: 401 });
    }

    const params = new URLSearchParams(rawBody);

    // Slash command: form-encoded with a `command` field.
    if (params.has('command')) {
      return handleSlashCommand(env, params);
    }
    // Interactivity (button clicks): form-encoded with a `payload` JSON field.
    if (params.has('payload')) {
      return handleInteractivity(env, params.get('payload') as string);
    }

    return new Response('ignored', { status: 200 });
  },
};
