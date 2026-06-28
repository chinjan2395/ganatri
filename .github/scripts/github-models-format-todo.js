#!/usr/bin/env node
// Formats a Slack TODO request into a well-formed TODO line using GitHub
// Models API, then inserts it into the target file between HTML comment markers.
//
// Required env vars:
//   REQUEST_TEXT        — raw Slack request text
//   GH_MODELS_TOKEN     — GitHub PAT with models:read scope
//   TARGET_FILE         — file to insert the line into
//   START_MARKER        — HTML comment marking start of the queue
//   END_MARKER          — HTML comment marking end of the queue
// Optional:
//   CONTEXT_FILE        — additional file passed as context to the model

const { readFileSync, writeFileSync } = require('fs');

(async () => {
  const {
    REQUEST_TEXT,
    GH_MODELS_TOKEN,
    TARGET_FILE,
    START_MARKER,
    END_MARKER,
    CONTEXT_FILE,
  } = process.env;

  if (!REQUEST_TEXT?.trim()) { console.error('REQUEST_TEXT is empty'); process.exit(1); }
  if (!GH_MODELS_TOKEN)      { console.error('GH_MODELS_TOKEN is required'); process.exit(1); }
  if (!TARGET_FILE || !START_MARKER || !END_MARKER) {
    console.error('TARGET_FILE, START_MARKER, END_MARKER are required');
    process.exit(1);
  }

  const content = readFileSync(TARGET_FILE, 'utf8');
  if (!content.includes(START_MARKER) || !content.includes(END_MARKER)) {
    console.error(`Markers not found in ${TARGET_FILE}`);
    process.exit(1);
  }

  const [before, afterStart] = content.split(START_MARKER, 2);
  const [queueBody, afterEnd]  = afterStart.split(END_MARKER, 2);

  // Skip if an equivalent unchecked item is already in the queue (retry-safe).
  const needle = REQUEST_TEXT.trim().toLowerCase().slice(0, 50);
  for (const line of queueBody.split('\n')) {
    if (line.trim().startsWith('- [ ]') && line.toLowerCase().includes(needle)) {
      console.log('Matching unchecked item already queued — no change');
      process.exit(0);
    }
  }

  // Pass a short context excerpt and existing queue sample to the model.
  let contextSnippet = '';
  if (CONTEXT_FILE) {
    try { contextSnippet = readFileSync(CONTEXT_FILE, 'utf8').slice(0, 2000); } catch { /* optional */ }
  }
  const queueSample = queueBody.split('\n')
    .filter(l => l.trim().startsWith('- ['))
    .slice(0, 3)
    .join('\n');

  const isPhase = START_MARKER.includes('PHASE_TODO');
  const dash = isPhase ? '-' : '—';

  const systemPrompt =
    `You format task requests for Ganatri, a multiplayer card game project.\n` +
    `Packages: \`packages/engine\` (game rules), \`packages/server\` (Socket.io backend), ` +
    `\`packages/web\` (React frontend)${isPhase ? ', `packages/db` (database layer)' : ''}.\n` +
    `Output ONLY a single TODO line in this exact format:\n` +
    `- [ ] **<concise title>** ${dash} <package(s)>. Acceptance: <one concrete testable criterion>.\n` +
    `Keep the title under 80 characters. No explanation, no extra text — just the one line.`;

  const userPrompt =
    (contextSnippet ? `Project context:\n${contextSnippet}\n\n` : '') +
    (queueSample    ? `Existing queue (format reference):\n${queueSample}\n\n` : '') +
    `Format this Slack request as a TODO line:\n"${REQUEST_TEXT.trim()}"`;

  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GH_MODELS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    console.error(`GitHub Models API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  const todoLine = data.choices?.[0]?.message?.content?.trim();

  if (!todoLine?.startsWith('- [ ]')) {
    console.error(`Unexpected model response: ${todoLine}`);
    process.exit(1);
  }

  // Insert at top of queue, replacing the "(none)" placeholder if present.
  const cleanedBody = queueBody
    .replace(/^\n+/, '')
    .replace(/^_\(none[^)]*\)_\n?/m, '');
  const newContent = before + START_MARKER + `\n${todoLine}\n${cleanedBody}` + END_MARKER + afterEnd;

  writeFileSync(TARGET_FILE, newContent, 'utf8');
  console.log(`github-models-format-todo: queued → ${todoLine}`);
})();
