# Ganatri Slack Worker (Cloudflare)

The inbound half of the Slack integration: a tiny Cloudflare Worker that turns a
Slack **slash command** and an **interactive button** into GitHub Actions runs.

```
/ganatri <text>       → Worker → repository_dispatch (slack-add-todo)
                               → .github/workflows/slack-add-todo.yml
                               → posts "Queued [Run now]" back to the channel

/ganatri-phase <text> → Worker → repository_dispatch (slack-add-phase-todo)
                               → .github/workflows/slack-add-phase-todo.yml
                               → posts "Queued [Run phase now]" back to the channel

click "Run now"       → Worker → workflow_dispatch (nightly.yml)
click "Run phase now" → Worker → workflow_dispatch (phase-nightly.yml)
```

Why Cloudflare Workers (not Render): Slack requires a response within **3 seconds**.
Workers run at the edge with no cold start; Render's free web services spin down and
cold-start ~50s, which would time out the slash command.

---

## 1. Prerequisites

- A Cloudflare account (free plan is fine).
- `npm` and the GitHub fine-grained PAT (Contents: write + Actions: write) from
  `docs/SLACK_INTEGRATION.md` Step 2.
- The Slack app already created (`docs/SLACK_INTEGRATION.md` Step 1) — you'll grab
  its **Signing Secret** below.

## 2. Configure & deploy

```bash
cd slack-worker
npm install

# Confirm the repo/workflow in wrangler.toml [vars] are correct:
#   GITHUB_REPO = "chinjan2395/ganatri"
#   NIGHTLY_WORKFLOW = "nightly.yml"
#   PHASE_NIGHTLY_WORKFLOW = "phase-nightly.yml"

# Set the two secrets (you'll be prompted to paste each value):
npx wrangler secret put SLACK_SIGNING_SECRET   # Slack app → Basic Information → Signing Secret
npx wrangler secret put GITHUB_TOKEN           # the fine-grained PAT

# First run will open a browser to log in to Cloudflare, then deploy:
npm run deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://ganatri-slack-worker.<your-subdomain>.workers.dev`. Copy it — this is the
**Request URL** for both Slack features below.

Tail logs while testing: `npm run tail`. Health check: open the URL in a browser →
`ganatri-slack-worker: ok`.

## 3. Point Slack at the Worker

In <https://api.slack.com/apps> → your app:

**a) Slash commands** — Features → **Slash Commands** → **Create New Command**:
- **Command:** `/ganatri`
- **Request URL:** the Worker URL
- **Short Description:** `Queue a requirement/bug for Ganatri`
- **Usage Hint:** `[what to build or fix]`
- Save.

Create a second command with the same Request URL:
- **Command:** `/ganatri-phase`
- **Request URL:** the Worker URL
- **Short Description:** `Queue full-phase Ganatri work`
- **Usage Hint:** `[phase work to build]`
- Save.

**b) Interactivity** — Features → **Interactivity & Shortcuts** → toggle **On**:
- **Request URL:** the same Worker URL
- Save.

**c) Reinstall** if Slack prompts that scopes/config changed
(Install App → **Reinstall to Workspace**). The bot still needs `chat:write` +
`files:write` from Step 1.

## 4. Test

```
/ganatri leaderboard shows the wrong rank on page 2
```

Expected: an ephemeral `📥 Queuing…`, then within a minute the channel gets
`✅ Queued as the next priority TODO: …` with a **▶️ Run now** button. Clicking it
replaces the message with `🚀 Nightly run dispatched…` and the nightly run starts.

For phase-branch work:

```
/ganatri-phase implement Phase 9 scoring DB layer
```

Expected: an ephemeral phase queue response, then a channel confirmation with a
**Run phase now** button. Clicking it dispatches `phase-nightly.yml`, which opens
sub-phase PRs into `phase/9-scoring` instead of `main`.

If nothing happens, `npm run tail` shows the Worker logs (signature failures, GitHub
non-2xx responses, etc.).

## Local dev

```bash
# Put secrets in slack-worker/.dev.vars (gitignored) for local runs:
#   SLACK_SIGNING_SECRET=...
#   GITHUB_TOKEN=...
npm run dev        # serves locally; use a tunnel (e.g. cloudflared) to expose to Slack
npm run typecheck  # tsc --noEmit
```

## What each var/secret is

| Name | Where | Purpose |
| --- | --- | --- |
| `SLACK_SIGNING_SECRET` | secret | verify requests really came from Slack |
| `GITHUB_TOKEN` | secret | fine-grained PAT to call GitHub dispatch APIs |
| `GITHUB_REPO` | `wrangler.toml` var | `owner/repo` to dispatch against |
| `NIGHTLY_WORKFLOW` | `wrangler.toml` var | workflow file the Run-now button dispatches |
| `PHASE_NIGHTLY_WORKFLOW` | `wrangler.toml` var | workflow file the Run-phase-now button dispatches |
