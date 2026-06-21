#!/usr/bin/env bash
# Insert a priority TODO line into docs/DEVELOPMENT_PLAN.md after the START marker.
# Used when Claude fails or makes no edit during slack-add-todo.
# Usage: slack-insert-priority-todo.sh "<raw slack request text>"
set -euo pipefail

REQUEST="${1:-}"
PLAN="docs/DEVELOPMENT_PLAN.md"

if [ -z "${REQUEST// /}" ]; then
  echo "slack-insert-priority-todo: empty request text" >&2
  exit 1
fi
if [ ! -f "$PLAN" ]; then
  echo "slack-insert-priority-todo: missing $PLAN" >&2
  exit 1
fi

python3 - "$REQUEST" "$PLAN" <<'PY'
import re
import sys

request = sys.argv[1].strip()
plan_path = sys.argv[2]

start = "<!-- PRIORITY_TODO:START -->"
end = "<!-- PRIORITY_TODO:END -->"

with open(plan_path, encoding="utf-8") as f:
    content = f.read()

if start not in content or end not in content:
    raise SystemExit("PRIORITY_TODO markers not found")

before, rest = content.split(start, 1)
queue_and_after = rest.split(end, 1)
queue_body = queue_and_after[0]
after = end + queue_and_after[1]

# Avoid duplicating the same unchecked item on workflow retries.
needle = request.casefold()
for line in queue_body.splitlines():
    stripped = line.strip()
    if stripped.startswith("- [ ]") and needle in stripped.casefold():
        print("slack-insert-priority-todo: matching unchecked item already queued — no change")
        sys.exit(0)

title = re.split(r"[.!?]\s+", request, maxsplit=1)[0].strip() or request
title = title[:80].rstrip()

text_lower = request.casefold()
paths: list[str] = []
if any(k in text_lower for k in ("server", "socket", "handler", "endpoint", "oauth", "auth")):
    paths.append("packages/server")
if any(k in text_lower for k in ("engine", "rules", "capture", "part 1", "part 2")):
    paths.append("packages/engine")
if any(k in text_lower for k in ("lobby", "screen", "ui", "button", "logo", "profile", "avatar", "google", "game session", "client", "web")):
    paths.append("packages/web")
if not paths:
    paths.append("TBD — review during nightly")

files = ", ".join(f"`{p}`" for p in paths)
acceptance = request.replace("\n", " ").strip()
if len(acceptance) > 220:
    acceptance = acceptance[:217] + "..."

line = f"- [ ] **{title}** — {files}. Acceptance: {acceptance}"

new_queue = f"\n{line}\n{queue_body.lstrip(chr(10))}"
new_content = before + start + new_queue + after

with open(plan_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"slack-insert-priority-todo: queued → {line}")
PY
