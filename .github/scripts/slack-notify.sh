#!/usr/bin/env bash
# Post a plain-text message to a Slack channel via chat.postMessage.
# Usage: slack-notify.sh <bot-token> <channel-id> <text> [unfurl:true|false]
# No-ops (exit 0) when the bot token is empty, so workflows degrade gracefully
# in repos/forks where the Slack secrets are not configured.
set -euo pipefail

TOKEN="${1:-}"
CHANNEL="${2:-}"
TEXT="${3:-}"
UNFURL="${4:-false}"

if [ -z "$TOKEN" ] || [ -z "$CHANNEL" ]; then
  echo "slack-notify: SLACK_BOT_TOKEN/SLACK_CHANNEL_ID not set — skipping notification."
  exit 0
fi

RESP=$(curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data "$(jq -n --arg ch "$CHANNEL" --arg t "$TEXT" --argjson u "$UNFURL" \
            '{channel:$ch, text:$t, unfurl_links:$u, unfurl_media:$u}')" \
  "https://slack.com/api/chat.postMessage")

if [ "$(echo "$RESP" | jq -r '.ok')" != "true" ]; then
  echo "slack-notify: Slack API error: $RESP" >&2
  exit 1
fi
echo "slack-notify: message posted to ${CHANNEL}."
