#!/usr/bin/env bash
# Record whether claude-code-action actually ran (vs. skipped on workflow validation).
# Prints a GitHub notice when skipped; always exits 0 so the job can continue cleanly.
set -euo pipefail

EXECUTION_FILE="${1:-}"

if [ -n "$EXECUTION_FILE" ] && [ -f "$EXECUTION_FILE" ]; then
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "claude_ran=true" >> "$GITHUB_OUTPUT"
  fi
  echo "Claude Code ran; execution log at ${EXECUTION_FILE}"
  exit 0
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "claude_ran=false" >> "$GITHUB_OUTPUT"
fi

cat >&2 <<'EOF'
Claude Code did not run (workflow validation skip).
The claude-code-action step exits successfully but skips when the workflow file on this ref
does not match the copy on the default branch. This is expected on PRs that modify
.github/workflows/. Merge those changes to main, then re-run.
Pass github_token to the action (already configured in nightly workflows) to use GITHUB_TOKEN
instead of the Claude GitHub App token exchange.
EOF

echo "::notice title=Claude skipped (workflow validation)::Claude did not run because this workflow ref differs from main. Merge workflow changes to main and re-run."
