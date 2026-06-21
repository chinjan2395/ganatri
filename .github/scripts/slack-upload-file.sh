#!/usr/bin/env bash
# Upload a file to a Slack channel using the current external-upload API
# (files.getUploadURLExternal -> PUT bytes -> files.completeUploadExternal).
# The legacy files.upload endpoint is deprecated, so we use the 3-step flow.
# Usage: slack-upload-file.sh <bot-token> <channel-id> <file-path> [title] [initial-comment]
# No-ops (exit 0) when the bot token is empty.
set -euo pipefail

TOKEN="${1:-}"
CHANNEL="${2:-}"
FILE="${3:-}"
TITLE="${4:-$(basename "${FILE:-file}")}"
COMMENT="${5:-}"

if [ -z "$TOKEN" ] || [ -z "$CHANNEL" ]; then
  echo "slack-upload: SLACK_BOT_TOKEN/SLACK_CHANNEL_ID not set — skipping upload."
  exit 0
fi
if [ ! -f "$FILE" ]; then
  echo "slack-upload: file not found: $FILE — skipping upload."
  exit 0
fi

NAME="$(basename "$FILE")"
LEN="$(wc -c < "$FILE" | tr -d ' ')"

# 1. Reserve an upload URL.
RESP="$(curl -sS -G \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode "filename=${NAME}" \
  --data-urlencode "length=${LEN}" \
  "https://slack.com/api/files.getUploadURLExternal")"
if [ "$(echo "$RESP" | jq -r '.ok')" != "true" ]; then
  echo "slack-upload: getUploadURLExternal failed: $RESP" >&2
  exit 1
fi
UPLOAD_URL="$(echo "$RESP" | jq -r '.upload_url')"
FILE_ID="$(echo "$RESP" | jq -r '.file_id')"

# 2. POST the raw bytes to the reserved URL.
curl -sS -f -F "filename=@${FILE}" "$UPLOAD_URL" > /dev/null

# 3. Finalize and share into the channel.
PAYLOAD="$(jq -n \
  --arg id "$FILE_ID" --arg title "$TITLE" --arg ch "$CHANNEL" --arg c "$COMMENT" \
  '{files:[{id:$id, title:$title}], channel_id:$ch} + (if $c == "" then {} else {initial_comment:$c} end)')"
RESP="$(curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data "$PAYLOAD" \
  "https://slack.com/api/files.completeUploadExternal")"
if [ "$(echo "$RESP" | jq -r '.ok')" != "true" ]; then
  echo "slack-upload: completeUploadExternal failed: $RESP" >&2
  exit 1
fi
echo "slack-upload: ${NAME} (${LEN} bytes) shared to ${CHANNEL}."
