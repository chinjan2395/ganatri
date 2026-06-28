#!/usr/bin/env bash
# Build a detailed Slack failure message for Ganatri CI workflows.
# Prints the message to stdout.
#
# Environment (all optional except TITLE and RUN_URL):
#   TITLE            - headline, e.g. "Nightly build failed"
#   RUN_URL          - link to the GitHub Actions run
#   WORKFLOW         - nightly | phase-nightly | other label
#   TASK             - unit of work / task title
#   BRANCH           - working branch name
#   BASE_BRANCH      - PR base branch (phase workflows)
#   FAILED_JOB       - job name that failed
#   FAILED_STEP      - step name that failed
#   EXECUTION_FILE   - path to claude-execution-output.json
#   EXTRA            - additional freeform lines (multiline ok)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TITLE="${TITLE:-Workflow failed}"
RUN_URL="${RUN_URL:-}"

lines=()
lines+=(":x: *${TITLE}*")
if [ -n "$RUN_URL" ]; then
  lines+=("<${RUN_URL}|View workflow run>")
fi

if [ -n "${WORKFLOW:-}" ]; then
  lines+=("*Workflow:* ${WORKFLOW}")
fi

if [ -n "${FAILED_JOB:-}" ]; then
  lines+=("*Failed job:* ${FAILED_JOB}")
fi

if [ -n "${FAILED_STEP:-}" ]; then
  lines+=("*Failed step:* ${FAILED_STEP}")
fi

if [ -n "${TASK:-}" ]; then
  CLEAN_TASK=$(bash "$SCRIPT_DIR/slack-nightly-msgs.sh" clean-task "$TASK" 2>/dev/null || printf '%s' "$TASK")
  if [ -n "$CLEAN_TASK" ]; then
    lines+=("*Task:* ${CLEAN_TASK}")
  fi
fi

if [ -n "${BRANCH:-}" ]; then
  lines+=("*Branch:* \`${BRANCH}\`")
fi

if [ -n "${BASE_BRANCH:-}" ]; then
  lines+=("*Base branch:* \`${BASE_BRANCH}\`")
fi

if [ -n "${EXECUTION_FILE:-}" ] && [ -f "$EXECUTION_FILE" ]; then
  CLAUDE_SUMMARY=$(bash "$SCRIPT_DIR/claude-execution-summary.sh" "$EXECUTION_FILE" || true)
  if [ -n "$CLAUDE_SUMMARY" ]; then
    lines+=("$CLAUDE_SUMMARY")
  fi
fi

if [ -n "${EXTRA:-}" ]; then
  lines+=("$EXTRA")
fi

# If we still have almost no context, nudge the reader to logs.
if [ "${#lines[@]}" -le 3 ] && [ -z "${EXECUTION_FILE:-}" ]; then
  lines+=("_No Claude execution file on this runner — check the failed step logs for the root cause._")
fi

printf '%s\n' "${lines[@]}"
