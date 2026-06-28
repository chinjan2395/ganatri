#!/usr/bin/env bash
# Print a human-readable summary of a Claude Code execution file (SDK message array).
# Usage: claude-execution-summary.sh <execution_file>
# Exits 0 with empty output when the file is missing or has no result message.
set -euo pipefail

EXECUTION_FILE="${1:-}"
if [ -z "$EXECUTION_FILE" ] || [ ! -f "$EXECUTION_FILE" ]; then
  exit 0
fi

RESULT=$(jq -c '[.[] | select(.type == "result")] | last' "$EXECUTION_FILE")
if [ "$RESULT" = "null" ] || [ -z "$RESULT" ]; then
  exit 0
fi

SUBTYPE=$(echo "$RESULT" | jq -r '.subtype // "unknown"')
IS_ERROR=$(echo "$RESULT" | jq -r '.is_error // false')
TURNS=$(echo "$RESULT" | jq -r '.num_turns // 0')
DURATION_MS=$(echo "$RESULT" | jq -r '.duration_ms // 0')
COST=$(echo "$RESULT" | jq -r '.total_cost_usd // 0')
DENIALS=$(echo "$RESULT" | jq -r '.permission_denials | length // 0')

DURATION_SEC=$(( (DURATION_MS + 999) / 1000 ))

echo "*Claude result*"
echo "• subtype: \`${SUBTYPE}\` · is_error: \`${IS_ERROR}\`"
echo "• turns: ${TURNS} · duration: ${DURATION_SEC}s · cost: \$${COST}"
if [ "${DENIALS:-0}" -gt 0 ]; then
  echo "• permission denials: ${DENIALS}"
  echo "$RESULT" | jq -r '.permission_denials[]? | "  - \(.tool_name // .tool // "tool"): \(.reason // .message // .)"' 2>/dev/null || true
fi

DETAIL=$(echo "$RESULT" | jq -r 'if .result then .result elif .errors then (.errors | join("\n")) else empty end')
if [ -n "$DETAIL" ]; then
  echo "*Error details*"
  # Slack-friendly truncation; keep full text in workflow logs.
  MAX=1800
  if [ "${#DETAIL}" -gt "$MAX" ]; then
    printf '%s\n… _(truncated — see workflow logs for full text)_' "${DETAIL:0:$MAX}"
  else
    printf '%s' "$DETAIL"
  fi
fi

# Last assistant text snippet when there is no result/errors field (opaque SDK failures).
if [ -z "$DETAIL" ] && [ "$IS_ERROR" = "true" ]; then
  LAST_TEXT=$(jq -r '
    [.[] | select(.type == "assistant" and .message.content != null)
     | .message.content[]
     | select(.type == "text")
     | .text] | last // empty
  ' "$EXECUTION_FILE" 2>/dev/null || true)
  if [ -n "$LAST_TEXT" ]; then
    echo "*Last assistant message*"
    MAX=1200
    if [ "${#LAST_TEXT}" -gt "$MAX" ]; then
      printf '%s\n… _(truncated)_' "${LAST_TEXT:0:$MAX}"
    else
      printf '%s' "$LAST_TEXT"
    fi
  fi
fi
