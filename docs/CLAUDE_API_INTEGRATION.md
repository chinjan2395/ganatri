# Claude for Development — Using Claude's Tooling to Build Ganatri Faster

This document is about **Claude as a development tool for this repo**, not Claude as a feature inside the game itself (no in-game AI opponents, no in-game chatbots — that idea was rejected). The question answered here: *given what Claude Code / Claude API / Anthropic tooling actually offers, are we using all of it to build Ganatri itself more effectively?*

Audit method: looked at what's actually configured in this repo (`.claude/agents`, `.claude/settings.local.json`, `.github/workflows/nightly.yml`, available MCP servers, available skills) versus what's available and unused.

---

## 1. What we're already using well

- **Custom subagents** (`.claude/agents/*.md`) — `rules-engine-dev`, `backend-dev`, `frontend-dev`, `code-reviewer` are defined and routed via `CLAUDE.md`'s "coordinator" model. This is the single highest-leverage Claude Code feature for this project and it's already in place.
- **Autonomous nightly builds** (`.github/workflows/nightly.yml`) — `anthropics/claude-code-action@v1` runs unattended against `docs/nightly/STATE.md` + `docs/DEVELOPMENT_PLAN.md`, picks one unit of work, and opens a PR. This is genuinely advanced usage (most teams don't have this yet).
- **`report-generator` agent** — for turning ad hoc requests into styled PDF reports.
- **Railway MCP + skill** — deploy/inspect Railway services without leaving the session.
- **Living docs as the coordination layer** — `docs/GAME_RULES.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/nightly/STATE.md` give every agent (human or Claude) one source of truth instead of re-deriving context. This is exactly the pattern Claude Code is designed around.

---

## 2. Gaps — capability available to you right now, not yet wired in

### a. `code-reviewer` agent isn't gated into CI
It exists (`.claude/agents/code-reviewer.md`) but `CLAUDE.md` only says to run it "after every phase" manually. There's no automated trigger — e.g. on every PR, or as a required step before the nightly workflow merges its own PR. Today a nightly PR could land without that review ever running.
**Action:** add a GitHub Actions job (or extend `nightly.yml`) that invokes `code-reviewer` against the diff before requesting merge, not just on request.

### b. `/code-review ultra` (multi-agent cloud review) is unused
This is a heavier, multi-agent review pass over a branch or PR — distinct from the lightweight local `code-reviewer` subagent. Worth running before merging a full phase (e.g. end of Phase 2/3), not for every small commit, since it's billed and slower.
**Action:** run `/code-review ultra` at phase boundaries (end of engine Part 2, end of server phase, etc.) as a gate, documented in `DEVELOPMENT_PLAN.md`.

### c. Semgrep MCP is available but not in the loop
A `semgrep` MCP server (`mcp__plugin_semgrep_semgrep__*`) is configured at the platform level with tools for static scanning, custom rules, and supply-chain scanning — but nothing in this repo calls it. For a Socket.io server handling room codes/session tokens, a recurring `semgrep_scan` pass (especially `semgrep_scan_supply_chain` against `package.json`) is cheap insurance.
**Action:** add a `semgrep_scan` step to the `code-reviewer` agent's checklist, or run it as part of the nightly workflow before opening a PR.

### d. Postman MCP is available but disconnected from `packages/server`
A Postman MCP server is configured (collection/spec/mock creation, workspace management). Ganatri's server exposes Socket.io events, not REST, so classic Postman collections are a partial fit — but if/when any REST endpoints exist (health checks, admin/ops routes), `mcp__claude_ai_Postman__generateCollection` from the running server could auto-produce a maintained collection instead of hand-written one.
**Action:** low priority until REST surface exists; revisit then.

### e. Prompt caching for dev-time agent runs
Every agent invocation (rules-engine-dev, backend-dev, etc.) re-reads `CLAUDE.md`, `docs/GAME_RULES.md`, and `docs/DEVELOPMENT_PLAN.md` from scratch each time it's spawned cold (per the project's own Agent-tool guidance: "each spawn starts cold and re-derives context"). These docs are large and static between edits.
**Action:** no direct lever here (subagent context isn't something you manually cache via API calls — it's managed by Claude Code itself), but you *can* reduce repeated cold-start cost by keeping agent prompts terse and pointing at doc paths rather than inlining doc content, so the agent reads only what it needs via `Read`/`Grep` instead of the orchestrator dumping full doc text into every dispatch.

### f. `DesignSync` (Claude Design / `/design-sync`) is available, unused for `packages/web`
This tool keeps a local component library in sync with a claude.ai Design System project — incremental push/pull of UI components with preview cards. For `packages/web`'s card-table UI (Part 1 capture layout, Part 2 trick/cut UI), this could give designers a live, browsable component library outside the codebase, and catch visual drift between design intent and implementation.
**Action:** only worth setting up once the UI has enough reusable components to justify a design system project (e.g. card, hand, table, capture-selector). Premature before then.

### g. Token counting / cost visibility for the nightly agent
`POST /v1/messages/count_tokens` exists but nothing in `nightly.yml` logs token usage or cost per run. Since this workflow runs autonomously and unattended (currently every 30 min in testing mode per the cron comment), cost can creep silently.
**Action:** have the nightly job log usage/cost from the action's own output (the `claude-code-action` typically surfaces this) into the PR description or a `docs/nightly/` log file, so cost is visible without manually checking billing.

### h. MCP resource introspection unused
`ListMcpResourcesTool` / `ReadMcpResourceTool` let you enumerate and read resources any connected MCP server exposes (Postman's instructions resource explicitly says to read it before answering API questions — per the system reminder already present in this session). If Postman or Railway resources are ever relevant to a task, these are the way to check before guessing.

---

## 3. Things deliberately NOT recommended

- **Managed Agents** (Anthropic-hosted sandboxed agent loop) — Claude Code's subagents + the nightly GitHub Action already cover "autonomous work in this repo." Managed Agents would duplicate that orchestration with a separate, redundant system.
- **In-game Claude features** (bot players, rules chat, moderation) — explicitly out of scope per your correction; not revisited here.
- **Adding more subagents than the four defined** — `rules-engine-dev` / `backend-dev` / `frontend-dev` / `code-reviewer` already cleanly partition the codebase (`packages/engine` / `packages/server` / `packages/web` / cross-cutting review). A fifth agent would need a genuinely distinct boundary to be worth the maintenance.

---

## 4. Suggested next concrete steps, in priority order

1. Wire `code-reviewer` (or `/code-review ultra` at phase boundaries) into the nightly workflow as a required gate before its PR is considered mergeable.
2. Add a Semgrep pass (`semgrep_scan` + `semgrep_scan_supply_chain`) to the same gate — cheap, catches a different class of issue than code review.
3. Add usage/cost logging to the nightly workflow output so the unattended cron job's spend is visible.
4. Defer Postman and DesignSync integration until the corresponding surface (REST endpoints / a real component library) exists — wiring them up now would be tooling for code that doesn't exist yet.
