#!/usr/bin/env bash
# Fail the workflow when Claude Code reports is_error or a non-success subtype.
# anthropics/claude-code-action only checks subtype === "success" and can mark the
# step green even when is_error is true in the SDK result message.
set -euo pipefail

EXECUTION_FILE="${1:-}"

if [ -z "$EXECUTION_FILE" ]; then
  echo "No Claude execution file provided (steps.claude.outputs.execution_file was empty)." >&2
  echo "If the Claude step log mentions 'workflow validation', the action skipped because this" >&2
  echo "workflow ref differs from main — merge .github/workflows/ changes to main and re-run." >&2
  echo "Otherwise check the 'Run Claude' step logs for the root cause." >&2
  exit 1
fi

if [ ! -f "$EXECUTION_FILE" ]; then
  echo "Claude execution file not found: $EXECUTION_FILE" >&2
  exit 1
fi

RESULT=$(jq -c '[.[] | select(.type == "result")] | last' "$EXECUTION_FILE")

if [ "$RESULT" = "null" ] || [ -z "$RESULT" ]; then
  echo "No result message in Claude execution output" >&2
  exit 1
fi

IS_ERROR=$(echo "$RESULT" | jq -r '.is_error // false')
SUBTYPE=$(echo "$RESULT" | jq -r '.subtype // "unknown"')

if [ "$IS_ERROR" = "true" ] || [ "$SUBTYPE" != "success" ]; then
  echo "Claude run failed (subtype=${SUBTYPE}, is_error=${IS_ERROR})" >&2
  DETAIL=$(echo "$RESULT" | jq -r 'if .result then .result elif .errors then (.errors | join(", ")) else empty end')
  if [ -n "$DETAIL" ]; then
    echo "Details: ${DETAIL}" >&2
  fi
  echo "$RESULT" | jq . >&2

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SUMMARY=$(TITLE="Claude implementation failed" \
      FAILED_STEP="Fail if Claude reported an error" \
      EXECUTION_FILE="$EXECUTION_FILE" \
      bash "$SCRIPT_DIR/slack-build-failure-msg.sh" 2>/dev/null || true)
    if [ -n "$SUMMARY" ]; then
      {
        echo "failure_summary<<EOF"
        printf '%s\n' "$SUMMARY"
        echo "EOF"
      } >> "$GITHUB_OUTPUT"
    fi
  fi

  exit 1
fi

echo "Claude run succeeded (subtype=${SUBTYPE}, turns=$(echo "$RESULT" | jq -r '.num_turns // 0'))"
