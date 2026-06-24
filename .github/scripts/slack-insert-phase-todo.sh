#!/usr/bin/env bash
# Insert a phase TODO line into docs/phase-nightly/STATE.md after the START marker.
# Used when Claude fails or makes no edit during slack-add-phase-todo.
# Usage: slack-insert-phase-todo.sh "<raw slack request text>"
set -euo pipefail

REQUEST="${1:-}"
STATE="docs/phase-nightly/STATE.md"

if [ -z "${REQUEST// /}" ]; then
  echo "slack-insert-phase-todo: empty request text" >&2
  exit 1
fi
if [ ! -f "$STATE" ]; then
  echo "slack-insert-phase-todo: missing $STATE" >&2
  exit 1
fi

python3 - "$REQUEST" "$STATE" <<'PY'
import re
import sys

request = sys.argv[1].strip()
state_path = sys.argv[2]

start = "<!-- PHASE_TODO:START -->"
end = "<!-- PHASE_TODO:END -->"

with open(state_path, encoding="utf-8") as f:
    content = f.read()

if start not in content or end not in content:
    raise SystemExit("PHASE_TODO markers not found")

before, rest = content.split(start, 1)
queue_body, after_rest = rest.split(end, 1)
after = end + after_rest

# Avoid duplicating the same unchecked item on workflow retries.
needle = request.casefold()
for line in queue_body.splitlines():
    stripped = line.strip()
    if stripped.startswith("- [ ]") and needle in stripped.casefold():
        print("slack-insert-phase-todo: matching unchecked item already queued - no change")
        sys.exit(0)

title = re.split(r"[.!?]\s+", request, maxsplit=1)[0].strip() or request
title = title[:80].rstrip()

text_lower = request.casefold()
paths: list[str] = []
if any(k in text_lower for k in ("db", "database", "schema", "migration", "progression", "ledger")):
    paths.append("packages/db")
if any(k in text_lower for k in ("server", "socket", "handler", "endpoint", "scoring", "rating", "xp")):
    paths.append("packages/server")
if any(k in text_lower for k in ("lobby", "screen", "ui", "history", "stats", "leaderboard", "client", "web")):
    paths.append("packages/web")
if any(k in text_lower for k in ("docs", "plan", "spec", "rules")):
    paths.append("docs")
if not paths:
    paths.append("Phase 9 - review during phase-nightly")

files = ", ".join(f"`{p}`" for p in paths)
acceptance = request.replace("\n", " ").strip()
if len(acceptance) > 220:
    acceptance = acceptance[:217] + "..."

line = f"- [ ] **{title}** - {files}. Acceptance: {acceptance}"

body_lines = [line]
existing = queue_body.strip("\n")
if existing and existing.strip() != "_(none)_":
    body_lines.append(existing)

new_queue = "\n" + "\n".join(body_lines) + "\n"
new_content = before + start + new_queue + after

with open(state_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"slack-insert-phase-todo: queued -> {line}")
PY
