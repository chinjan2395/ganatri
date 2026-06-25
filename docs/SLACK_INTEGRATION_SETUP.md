# Slack Integration Setup Guide

This document describes the complete setup for integrating Slack with the Ganatri project, including all required dependencies, services, environment variables, and step-by-step instructions for obtaining each variable.

## Overview

The Slack integration enables team members to:
- Submit priority TODOs via `/ganatri` slash command
- Submit phase work via `/ganatri-phase` slash command
- Trigger nightly runs and phase nightly runs with button clicks
- Receive notifications about task queuing and workflow status

**Architecture:** Slack → Cloudflare Worker → GitHub Actions Workflows

---

## 1. Dependencies

### Local Development / Deployment

#### `slack-worker/package.json`
Located in the `slack-worker` directory:

```json
{
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241106.0",
    "typescript": "^5.6.0",
    "wrangler": "^4.103.0"
  }
}
```

**Key Dependencies:**
- **wrangler** — Cloudflare Workers CLI for local development, testing, and deployment
- **@cloudflare/workers-types** — TypeScript type definitions for Cloudflare Workers API
- **typescript** — TypeScript compiler for type checking

**Install these:**
```bash
cd slack-worker
npm install
```

### Root Project

The root `package.json` uses workspaces and requires **Node.js ≥22** for all development.

---

## 2. Services

### 2.1 Cloudflare Workers

**Service:** Cloudflare Workers  
**Purpose:** Handles inbound Slack requests (slash commands, button clicks) and bridges them to GitHub Actions  
**Worker Name:** `ganatri-slack-worker`  
**File:** `slack-worker/wrangler.toml`

**Responsibilities:**
1. Verifies Slack request signatures (security)
2. Handles slash commands (`/ganatri`, `/ganatri-phase`)
3. Handles interactive button clicks (Run now, Run phase now)
4. Dispatches GitHub Actions workflows via GitHub REST API

### 2.2 GitHub Actions

**Service:** GitHub Actions  
**Purpose:** Runs workflows to process Slack requests and execute work

**Three main workflows:**

| Workflow | Triggered By | Purpose |
|----------|--------------|---------|
| `slack-add-todo.yml` | `/ganatri` slash command | Formats priority TODOs and commits to `docs/DEVELOPMENT_PLAN.md` |
| `slack-add-phase-todo.yml` | `/ganatri-phase` slash command | Formats phase work and commits to `docs/phase-nightly/STATE.md` |
| `nightly.yml` / `phase-nightly.yml` | "Run now" / "Run phase now" button | Executes work items from the queue |

### 2.3 Slack Workspace

**Service:** Slack App (your workspace)  
**Purpose:** Provides slash commands and interactive components

**Slack App Configuration:**
- Slash commands: `/ganatri`, `/ganatri-phase`
- Request URL: Points to the Cloudflare Worker
- Interactive components enabled
- Bot scopes: `chat:write`

---

## 3. Environment Variables & Secrets

### 3.1 Cloudflare Worker Secrets

These are **sensitive** and should never be committed to git. Set them using:

```bash
cd slack-worker
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put GITHUB_TOKEN
```

| Secret | Description | How to Obtain |
|--------|-------------|---------------|
| `SLACK_SIGNING_SECRET` | Slack app signing secret for request verification | See [§ 4.2](#42-slack-signing-secret) |
| `GITHUB_TOKEN` | GitHub Personal Access Token (fine-grained, with Contents:write + Actions:write) | See [§ 4.3](#43-github-token) |

### 3.2 Cloudflare Worker Variables (Non-Secret)

Set in `slack-worker/wrangler.toml`:

```toml
[vars]
GITHUB_REPO = "chinjan2395/ganatri"
NIGHTLY_WORKFLOW = "nightly.yml"
PHASE_NIGHTLY_WORKFLOW = "phase-nightly.yml"
```

| Variable | Description | Value |
|----------|-------------|-------|
| `GITHUB_REPO` | GitHub repository in `owner/repo` format | `chinjan2395/ganatri` (or your fork) |
| `NIGHTLY_WORKFLOW` | Filename of the nightly workflow | `nightly.yml` |
| `PHASE_NIGHTLY_WORKFLOW` | Filename of the phase nightly workflow | `phase-nightly.yml` |

### 3.3 GitHub Actions Secrets

Set in GitHub repository settings → Secrets and variables → Actions:

```
https://github.com/<owner>/<repo>/settings/secrets/actions
```

| Secret | Scope | Description | How to Obtain |
|--------|-------|-------------|---------------|
| `SLACK_BOT_TOKEN` | All workflows using Slack | Slack bot token for posting messages to channel | See [§ 4.1](#41-slack-bot-token) |
| `SLACK_CHANNEL_ID` | All workflows using Slack | Slack channel ID where notifications are posted | See [§ 4.4](#44-slack-channel-id) |
| `CLAUDE_CODE_OAUTH_TOKEN` | `slack-add-todo.yml`, `slack-add-phase-todo.yml` | OAuth token for Claude Code GitHub Actions | See [§ 4.5](#45-claude-code-oauth-token) |
| `GITHUB_TOKEN` | All workflows (auto-created by GitHub) | GitHub token for API access and git operations | Auto-created by GitHub Actions |

---

## 4. Step-by-Step Variable Setup

### 4.1 Slack Bot Token (`SLACK_BOT_TOKEN`)

**Where it's used:** GitHub Actions workflows for posting notifications to Slack

**How to obtain:**

1. Go to your Slack workspace's app directory: https://api.slack.com/apps
2. Select your app (or create one if needed)
3. Navigate to **OAuth & Permissions** (left sidebar)
4. Under **Scopes**, ensure `chat:write` is selected under Bot Token Scopes
5. Scroll to the top of the page
6. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
7. In GitHub: Settings → Secrets and variables → Actions → New repository secret
8. Name: `SLACK_BOT_TOKEN`, Paste the token

**Verify:** The token format is `xoxb-<numbers>-<numbers>-<alphanumeric>`

---

### 4.2 Slack Signing Secret (`SLACK_SIGNING_SECRET`)

**Where it's used:** Cloudflare Worker to verify requests from Slack are legitimate

**How to obtain:**

1. Go to https://api.slack.com/apps
2. Select your app
3. Navigate to **Basic Information** (left sidebar)
4. Scroll to **App Credentials**
5. Copy the **Signing Secret** (starts with `xxxx-` or similar)
6. In your terminal:
   ```bash
   cd slack-worker
   wrangler secret put SLACK_SIGNING_SECRET
   # Paste the secret when prompted
   ```

**Verify:** Request a signature verification from Slack using a test curl if needed (advanced)

---

### 4.3 GitHub Personal Access Token (`GITHUB_TOKEN`)

**Where it's used:**
- Cloudflare Worker to dispatch GitHub Actions workflows
- GitHub Actions to push changes to the repo

**How to obtain:**

1. Go to https://github.com/settings/tokens?type=beta
2. Click **Generate new token**
3. Select **Fine-grained personal access tokens**
4. Fill in details:
   - **Token name:** `ganatri-slack-worker`
   - **Expiration:** 90 days (or as preferred by your org)
   - **Resource owner:** Select your GitHub organization/account
   - **Repository access:** Select "Only select repositories" → Choose the ganatri repo
   - **Repository permissions:**
     - ✅ **Actions** → Read & write
     - ✅ **Contents** → Read & write
5. Click **Generate token**
6. Copy the token immediately (you won't see it again)
7. For Cloudflare Worker:
   ```bash
   cd slack-worker
   wrangler secret put GITHUB_TOKEN
   # Paste the token when prompted
   ```
8. For GitHub Actions: Settings → Secrets and variables → Actions → New repository secret
   - Name: `GITHUB_TOKEN` (this is often auto-created; if not, add it)
   - Paste the token

**Verify:** Test with:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/user
```

---

### 4.4 Slack Channel ID (`SLACK_CHANNEL_ID`)

**Where it's used:** GitHub Actions workflows to post notifications in the correct Slack channel

**How to obtain:**

1. Open your Slack workspace
2. Right-click on the channel name → **View channel details**
3. Scroll down to the **About** tab
4. Copy the **Channel ID** (format: `C1234567890`)
   - Alternatively, right-click channel → Copy link, the ID is in the URL: `slack.com/archives/C1234567890`
5. In GitHub: Settings → Secrets and variables → Actions → New repository secret
   - Name: `SLACK_CHANNEL_ID`
   - Paste the channel ID

**Verify:** The format is `C` followed by 9+ digits

---

### 4.5 Claude Code OAuth Token (`CLAUDE_CODE_OAUTH_TOKEN`)

**Where it's used:** GitHub Actions workflows to run Claude Code via `anthropics/claude-code-action@v1`

**How to obtain:**

1. Go to https://claude.com/claude-code or use the Claude Code desktop app
2. In Claude Code, open **Settings** → **GitHub Integration**
3. Click **Connect to GitHub** if not already connected
4. Authorize Claude Code to access your GitHub account
5. Copy the OAuth token that is displayed (or find it in your personal access tokens on GitHub)
   - Alternatively, generate a fine-grained personal access token at https://github.com/settings/tokens?type=beta with:
     - **Token name:** `claude-code-oauth`
     - **Expiration:** 90 days
     - **Repository access:** Only select repositories → ganatri
     - **Permissions:**
       - ✅ **Contents** → Read & write
       - ✅ **Metadata** → Read-only
6. In GitHub: Settings → Secrets and variables → Actions → New repository secret
   - Name: `CLAUDE_CODE_OAUTH_TOKEN`
   - Paste the token

**Verify:** Works with `anthropics/claude-code-action@v1` in workflows

---

## 5. GitHub Workflows

### 5.1 Slack Add Todo Workflow (`slack-add-todo.yml`)

**Triggered by:** `/ganatri <text>` slash command  
**Flow:** Slack → Cloudflare Worker → GitHub Dispatch → Workflow

**Steps:**
1. Validates the payload (ensures text is not empty)
2. Sets up Node.js
3. **Claude Code step:** Formats the raw text into a priority-TODO line
   - Reads `docs/DEVELOPMENT_PLAN.md`
   - Inserts the formatted TODO at the top of the priority queue
   - Returns if successful or skips if Claude is unavailable
4. **Fallback step:** If Claude made no edit, uses a bash script to insert the TODO
5. Commits the change to `main` branch
6. Posts a confirmation message to Slack with a "▶️ Run now" button

**Environment Variables Used:**
- `SLACK_BOT_TOKEN` — For posting to Slack
- `SLACK_CHANNEL_ID` — For posting to the correct channel

**Key Secrets:**
- `GITHUB_TOKEN` — For git operations
- `CLAUDE_CODE_OAUTH_TOKEN` — For Claude Code execution

---

### 5.2 Slack Add Phase Todo Workflow (`slack-add-phase-todo.yml`)

**Triggered by:** `/ganatri-phase <text>` slash command  
**Flow:** Slack → Cloudflare Worker → GitHub Dispatch → Workflow

**Steps:**
1. Validates the payload
2. Sets up Node.js
3. **Claude Code step:** Formats text into a phase-TODO line
   - Reads `docs/phase-nightly/STATE.md`
   - Reads `docs/DEVELOPMENT_PLAN.md` for context
   - Inserts the formatted TODO at the top of the phase queue
4. **Fallback step:** Uses bash script if Claude makes no edit
5. Commits to `main` branch
6. Posts confirmation to Slack with "Run phase now" button

**Environment Variables Used:**
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

**Key Secrets:**
- `GITHUB_TOKEN`
- `CLAUDE_CODE_OAUTH_TOKEN`

---

### 5.3 Nightly Workflow (`nightly.yml`)

**Triggered by:**
1. Schedule (cron)
2. Button click: "▶️ Run now" (via workflow_dispatch)
3. Manual trigger from GitHub UI

**Purpose:** Executes the top item from the priority-TODO queue

**Expected files to change:**
- `docs/DEVELOPMENT_PLAN.md` — Marks completed items with ✅

---

### 5.4 Phase Nightly Workflow (`phase-nightly.yml`)

**Triggered by:**
1. Schedule (cron)
2. Button click: "Run phase now" (via workflow_dispatch)
3. Manual trigger from GitHub UI

**Purpose:** Executes the top item from the phase-TODO queue

**Expected files to change:**
- `docs/phase-nightly/STATE.md` — Updates phase work progress

---

## 6. Slack App Configuration

### 6.1 Creating a Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. **App name:** `ganatri` (or preferred name)
4. **Development Slack Workspace:** Select your workspace
5. Click **Create App**

### 6.2 Configure Slash Commands

1. In your app, go to **Slash Commands** (left sidebar)
2. Click **Create New Command**
3. For `/ganatri`:
   - **Command:** `/ganatri`
   - **Request URL:** (see below for Cloudflare Worker URL)
   - **Short description:** `Add a priority TODO to the build queue`
   - **Usage hint:** `what to build or fix — e.g. leaderboard shows wrong rank on page 2`
4. Click **Save**
5. Repeat for `/ganatri-phase`:
   - **Command:** `/ganatri-phase`
   - **Short description:** `Add a phase TODO to the phase build queue`
   - **Usage hint:** `phase work to build — e.g. implement Phase 9 scoring`

### 6.3 Configure Interactive Components

1. Go to **Interactivity & Shortcuts** (left sidebar)
2. Toggle **Interactivity** to **On**
3. **Request URL:** (see below for Cloudflare Worker URL)
4. Click **Save**

### 6.4 Get Your Cloudflare Worker URL

After deploying the Cloudflare Worker (see [§ 7](#7-deployment)):

```bash
cd slack-worker
wrangler deploy
```

The output will show:
```
Deployment successful! Your worker is published to:
https://ganatri-slack-worker.<your-account>.workers.dev
```

Use this URL for:
- Slash Commands → **Request URL**
- Interactivity & Shortcuts → **Request URL**

### 6.5 Install the App to Your Workspace

1. Go to **Install App** or **OAuth & Permissions** (left sidebar)
2. Click **Install to Workspace**
3. Authorize the app
4. Copy the **Bot User OAuth Token** (see [§ 4.1](#41-slack-bot-token))

---

## 7. Deployment

### 7.1 Deploy the Cloudflare Worker

```bash
cd slack-worker

# Install dependencies (if not done)
npm install

# Type check
npm run typecheck

# Deploy to Cloudflare
npm run deploy
```

After deployment, you'll see:
```
Deployment successful! Your worker is published to:
https://ganatri-slack-worker.<your-account>.workers.dev
```

### 7.2 Set Cloudflare Worker Secrets

After deploying, set the secrets:

```bash
cd slack-worker

# Set Slack signing secret
wrangler secret put SLACK_SIGNING_SECRET
# Paste the secret from Slack → Basic Information

# Set GitHub token
wrangler secret put GITHUB_TOKEN
# Paste your fine-grained PAT
```

### 7.3 Verify Deployment

Test the worker health check:

```bash
curl https://ganatri-slack-worker.<your-account>.workers.dev
```

Expected response:
```
ganatri-slack-worker: ok
```

---

## 8. Testing the Integration

### 8.1 Test Slash Command

1. In your Slack workspace, type `/ganatri test this works`
2. You should see an ephemeral message: `📥 Queuing: "test this works"`
3. Within seconds, a confirmation should appear in the configured channel:
   ```
   ✅ Added to the build queue
   - [ ] Test this works — ... Acceptance: test this works
   ```

### 8.2 Test Phase Slash Command

1. Type `/ganatri-phase test phase work`
2. Same flow as above, but for phase work

### 8.3 Test Button Clicks

1. Click the "▶️ Run now" button in Slack
2. The `nightly.yml` workflow should start (check GitHub Actions)
3. You should see a message in Slack: `🚀 Nightly run dispatched — watch this channel for progress.`

### 8.4 Test Development Mode

For local testing:

```bash
cd slack-worker
npm run dev
```

This starts a local server at `http://localhost:8787` (by default). You can test with curl:

```bash
# Test health check
curl http://localhost:8787

# Test with a test signature (requires generating valid signature)
# See slack-worker/src/index.ts for verification logic
```

---

## 9. Troubleshooting

### Issue: Slack reports "Invalid URL"

**Cause:** Cloudflare Worker URL not set correctly in Slack app config  
**Fix:** 
1. Run `npm run deploy` and copy the full URL
2. Update Slack app → Slash Commands → **Request URL**
3. Update Slack app → Interactivity & Shortcuts → **Request URL**
4. Test again with `/ganatri test`

### Issue: "Invalid signature" from Worker

**Cause:** `SLACK_SIGNING_SECRET` doesn't match  
**Fix:**
1. Get the signing secret from Slack → Basic Information
2. Update: `cd slack-worker && wrangler secret put SLACK_SIGNING_SECRET`
3. Redeploy: `npm run deploy`

### Issue: GitHub dispatch fails

**Cause:** `GITHUB_TOKEN` doesn't have correct permissions  
**Fix:**
1. Verify the token has **Actions:write** and **Contents:write**
2. Token is not expired (check https://github.com/settings/tokens?type=beta)
3. Regenerate if needed and update: `wrangler secret put GITHUB_TOKEN`

### Issue: Workflow never posts to Slack

**Cause:** `SLACK_BOT_TOKEN` or `SLACK_CHANNEL_ID` incorrect  
**Fix:**
1. Verify both values in GitHub → Settings → Secrets
2. Test bot token: `curl -X POST https://slack.com/api/auth.test -H "Authorization: Bearer TOKEN"`
3. Verify channel ID format: `C` followed by 9+ digits
4. Update and re-run workflow

### Issue: Claude Code step fails in workflow

**Cause:** `CLAUDE_CODE_OAUTH_TOKEN` expired or invalid  
**Fix:**
1. Generate a new token at https://github.com/settings/tokens?type=beta
2. Update: GitHub Settings → Secrets → `CLAUDE_CODE_OAUTH_TOKEN`
3. Re-run the workflow

---

## 10. Summary Checklist

**Before you start:**
- [ ] Slack workspace created and accessible
- [ ] GitHub repository (with push access)
- [ ] Node.js 22+ installed locally
- [ ] Cloudflare account (free tier works)

**Setup steps:**
- [ ] Create Slack app (https://api.slack.com/apps)
- [ ] Generate GitHub fine-grained PAT (https://github.com/settings/tokens?type=beta)
- [ ] Obtain Slack Bot Token (OAuth & Permissions)
- [ ] Obtain Slack Signing Secret (Basic Information)
- [ ] Obtain Slack Channel ID (right-click channel in Slack)
- [ ] Obtain Claude Code OAuth Token (GitHub settings or Claude Code)
- [ ] Deploy Cloudflare Worker: `cd slack-worker && npm run deploy`
- [ ] Set Cloudflare secrets: `wrangler secret put SLACK_SIGNING_SECRET && wrangler secret put GITHUB_TOKEN`
- [ ] Update `slack-worker/wrangler.toml` with your repo (`GITHUB_REPO`)
- [ ] Configure Slack app: slash commands and interactivity with Worker URL
- [ ] Set GitHub Actions secrets: `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `CLAUDE_CODE_OAUTH_TOKEN`
- [ ] Test with `/ganatri test` in Slack

**Deployment verification:**
- [ ] Worker health check passes: `curl <worker-url>`
- [ ] Slack app recognizes slash commands
- [ ] Test Slack message appears in configured channel
- [ ] Button click triggers GitHub workflow
- [ ] GitHub workflow completes successfully

---

## 11. References

- [Slack API Documentation](https://api.slack.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub REST API - Repository Dispatch](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#create-a-repository-dispatch-event)
- [Anthropic Claude Code GitHub Action](https://github.com/anthropics/claude-code-action)

