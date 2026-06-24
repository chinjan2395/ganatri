# Slack ↔ Ganatri Integration

Two-way Slack integration. The **GitHub → Slack** half runs entirely in GitHub Actions.
The **Slack → GitHub** half uses a Slack **slash command** + a small **Cloudflare Worker**
(`slack-worker/`) — this works on **any** Slack plan and avoids Workflow Builder, which is
paid-only and gates the "Send a web request" step behind admin connector permissions.

## What you get

**GitHub → Slack** (handled inside `.github/workflows/nightly.yml`):
- 🛠️ a message when a nightly run starts (with branch + whether it's working a priority item),
- 📊 the development **report zip** uploaded straight into the channel,
- ✅ a message when the run finishes (with the PR link), and ❌ on failure.

**Slack → GitHub** (via the Cloudflare Worker in `slack-worker/`):
- `/ganatri <text>` in Slack → `slack-add-todo.yml` runs, Claude formats it into a proper
  `- [ ]` line, inserts it as the **next** item in the Priority TODO queue in
  `docs/DEVELOPMENT_PLAN.md`, commits to `main`, and confirms back in Slack with an
  interactive **▶️ Run now** button.
- Click **▶️ Run now** → dispatches the nightly workflow immediately.
- `/ganatri-phase <text>` in Slack → `slack-add-phase-todo.yml` runs, Claude formats it into
  a phase TODO in `docs/phase-nightly/STATE.md`, commits to `main`, and confirms back in Slack
  with an interactive **Run phase now** button.
- Click **Run phase now** → dispatches `phase-nightly.yml`, which opens sub-phase PRs into
  `phase/9-scoring` instead of `main`.

```
                          ┌──────────────── GitHub Actions ────────────────┐
  /ganatri <text>  ─► CF Worker ─► repository_dispatch ─► slack-add-todo.yml
                                     (slack-add-todo)      │ Claude formats + commits to main
                                                           ▼
  Slack channel  ◄──────── chat.postMessage ◄──── "✅ Queued  [▶️ Run now]"
        │
        └─ click ▶️ Run now ─► CF Worker ─► workflow_dispatch ─► nightly.yml ─► 🛠️📊✅

  /ganatri-phase <text> ─► CF Worker ─► repository_dispatch ─► slack-add-phase-todo.yml
                                           (slack-add-phase-todo) │ commits phase queue to main
                                                                  ▼
  Slack channel ◄──────────── chat.postMessage ◄──── "Queued  [Run phase now]"
        │
        └─ click Run phase now ─► CF Worker ─► workflow_dispatch ─► phase-nightly.yml
                                                            │
                                                            └─ PR base: phase/9-scoring
```

## Prerequisites / caveats (read this)

- **Slack → GitHub needs the Cloudflare Worker** in `slack-worker/` deployed (free tier).
  Slash commands + interactivity work on **any** Slack plan — no Workflow Builder, no paid
  plan, no admin connector toggle.
- Adding a TODO **commits directly to `main`**. If you protect `main`, allow
  `github-actions[bot]` to push, or this step will fail.

---

## Step 1 — Create the Slack app + bot token

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**. Name it
   `Ganatri Bot`, pick your workspace.
2. **OAuth & Permissions** → **Bot Token Scopes**, add:
   - `chat:write` — post messages
   - `files:write` — upload the report zip
3. Scroll up → **Install to Workspace** → authorize. Copy the **Bot User OAuth Token**
   (starts with `xoxb-`).
4. In Slack, create/choose a channel (e.g. `#ganatri-builds`) and **invite the bot**:
   type `/invite @Ganatri Bot` in that channel.
5. Get the **channel ID**: in Slack, click the channel name → bottom of the **About** tab
   shows an ID like `C0123ABCD`. (Or right-click the channel → *Copy link*; the last path
   segment is the ID.)

## Step 2 — Create a GitHub token for Slack → GitHub calls

Slack needs a credential to call the GitHub API. Create a **fine-grained PAT**:

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
2. **Repository access:** only `chinjan2395/ganatri`.
3. **Permissions → Repository:**
   - **Contents:** Read and write (needed for the TODO commit / dispatch)
   - **Actions:** Read and write (needed for `workflow_dispatch`)
4. Generate and copy it (`github_pat_…`). You'll set this on the Cloudflare Worker as
   `GITHUB_TOKEN` in Step 4 (it is **not** a GitHub Actions secret).

## Step 3 — Add GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `SLACK_BOT_TOKEN` | the `xoxb-…` bot token from Step 1 |
| `SLACK_CHANNEL_ID` | the channel ID from Step 1 (e.g. `C0123ABCD`) |

`CLAUDE_CODE_OAUTH_TOKEN` already exists (used by the nightly). All Slack steps **no-op
gracefully** if `SLACK_BOT_TOKEN` is unset, so nothing breaks before you finish setup.

> The PAT and the Slack **Signing Secret** are **not** GitHub secrets — they are set on the
> Cloudflare Worker (`wrangler secret put …`, see `slack-worker/README.md`).

## Step 4 — Deploy the Cloudflare Worker (the inbound bridge)

Everything Slack → GitHub goes through the Worker in **`slack-worker/`**. Full instructions
are in **[`slack-worker/README.md`](../slack-worker/README.md)**. In short:

```bash
cd slack-worker
npm install
npx wrangler secret put SLACK_SIGNING_SECRET   # Slack app → Basic Information → Signing Secret
npx wrangler secret put GITHUB_TOKEN           # the fine-grained PAT from Step 2
npm run deploy                                 # prints the Worker URL
```

Then in <https://api.slack.com/apps> → your app:
- **Slash Commands → Create New Command:** `/ganatri`, **Request URL** = the Worker URL.
- **Slash Commands → Create New Command:** `/ganatri-phase`, **Request URL** = the same Worker URL.
- **Interactivity & Shortcuts → On:** **Request URL** = the same Worker URL.
- **Reinstall to Workspace** if prompted.

That's it — no Workflow Builder. The `▶️ Run now` button is a real interactive button the
Worker handles. The PAT and Signing Secret live on the Worker, not in GitHub secrets.

---

## Testing

**GitHub → Slack:** Actions → **Ganatri Nightly Build** → **Run workflow** → `main`.
Watch the channel for the started → report-zip → finished messages.

**Slack → GitHub (add TODO):** in Slack run
`/ganatri leaderboard shows the wrong rank on page 2`. Within a minute you should get a
confirmation with the formatted `- [ ]` line, and `docs/DEVELOPMENT_PLAN.md` on `main` will
have a new queue item. Click **▶️ Run now** to kick off a build immediately, or let the
3-hourly nightly pick it up. (`npm run tail` in `slack-worker/` streams Worker logs.)

**Slack → GitHub (add phase TODO):** in Slack run
`/ganatri-phase implement Phase 9 scoring DB layer`. Within a minute you should get a
confirmation with a phase TODO in `docs/phase-nightly/STATE.md`. Click **Run phase now** to
dispatch `phase-nightly.yml`; the resulting PR should target `phase/9-scoring`.

**Quick API smoke test (no Slack needed)** — verifies the PAT + dispatch wiring:

```bash
curl -X POST \
  -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/chinjan2395/ganatri/dispatches \
  -d '{"event_type":"slack-add-todo","client_payload":{"text":"test: add a no-op TODO"}}'
```

For the phase queue, use:

```bash
curl -X POST \
  -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/chinjan2395/ganatri/dispatches \
  -d '{"event_type":"slack-add-phase-todo","client_payload":{"text":"test: add a phase TODO"}}'
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| No Slack messages at all | `SLACK_BOT_TOKEN`/`SLACK_CHANNEL_ID` unset, or bot not invited to the channel |
| `not_in_channel` in logs | `/invite @Ganatri Bot` into the channel |
| Report not uploaded | bot missing `files:write`, or the run produced no `reports/*` files |
| `/ganatri` says "dispatch failed" | Worker `GITHUB_TOKEN` missing/expired or lacks **Contents: write**; check `npm run tail` |
| Slash command returns "signature" error | wrong `SLACK_SIGNING_SECRET` on the Worker |
| `▶️ Run now` does nothing | Interactivity Request URL not set to the Worker, or PAT lacks **Actions: write** |
| `slack-add-todo` commit fails | `main` is protected — allow `github-actions[bot]` to push |
| `slack-add-phase-todo` commit fails | same as above; phase TODOs are also committed to `main` |
| GitHub returns 404 on dispatch | PAT scopes wrong, or `GITHUB_REPO` in `wrangler.toml` is wrong |
| TODO added but nightly ignores it | it must be on `main` between the `PRIORITY_TODO` markers as an unchecked `- [ ]` |
| Phase TODO added but phase nightly ignores it | it must be on `main` between the `PHASE_TODO` markers in `docs/phase-nightly/STATE.md` |
