#!/usr/bin/env bash
# Human-friendly Slack text helpers for Ganatri nightly / todo notifications.
set -euo pipefail

# Bullet list of commit subjects on this branch (origin/main..HEAD), newest first.
commits_bullets() {
  local max="${1:-5}"
  local count=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "• ${line}"
    count=$((count + 1))
    [ "$count" -ge "$max" ] && break
  done < <(git log origin/main..HEAD --format='%s' 2>/dev/null || true)
}

# Short title from a priority-TODO line or plain text.
clean_task_title() {
  local t="${1:-}"
  printf '%s' "$t" | sed -E \
    's/^[[:space:]]*- \[[ x]\] //; s/\*\*([^*]+)\*\*.*/\1/; s/ — .*//; s/^[[:space:]]+//; s/[[:space:]]+$//'
}

# First open nightly PR as "#42 — title" (no branch name).
format_open_pr() {
  local raw="${1:-}"
  printf '%s' "$raw" | sed -E 's/ \([^)]+\)//'
}

case "${1:-}" in
  commits) commits_bullets "${2:-5}" ;;
  clean-task) clean_task_title "${2:-}" ;;
  clean-pr) format_open_pr "${2:-}" ;;
  *)
    echo "Usage: slack-nightly-msgs.sh {commits|clean-task|clean-pr} [arg]" >&2
    exit 1
    ;;
esac
