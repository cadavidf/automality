#!/usr/bin/env node
// automality — PreToolUse hook enforcing Felipe's "no plaintext secrets in
// chat" rule: catches likely API keys/tokens/passwords about to be written
// to a file or run in a Bash command (which echoes it into the transcript),
// and asks for confirmation instead of silently letting it through.
//
// Like automality-pricing-guard.js, this asks rather than denies — pattern
// matching on secrets is inherently approximate (real false positives:
// example/placeholder keys in docs, test fixtures), so a human call is the
// right resolution, not a hard block.

const fs = require('fs');

// Known token-prefix formats first (low false-positive rate), then a
// generic "secret-ish keyword assigned a long literal" fallback. Doesn't
// match `os.environ["API_KEY"]` / `process.env.API_KEY` references -- those
// carry no long literal value, which is exactly the point (env var/Keychain
// references are the correct pattern this rule wants people pushed toward).
const SECRET_PATTERNS = [
  /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/,        // OpenAI/Anthropic-style keys
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,           // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/,                     // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,         // Slack tokens
  /\b(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/i,
];

function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function allow() {
  respond({});
}

function ask(reason) {
  respond({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  });
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  allow();
}

const toolName = input.tool_name;
const toolInput = input.tool_input || {};

let text = '';
if (toolName === 'Edit') {
  text = String(toolInput.old_string || '') + '\n' + String(toolInput.new_string || '');
} else if (toolName === 'Write') {
  text = String(toolInput.content || '');
} else if (toolName === 'Bash') {
  text = String(toolInput.command || '');
} else {
  allow();
}

const hit = SECRET_PATTERNS.find((re) => re.test(text));
if (!hit) {
  allow();
}

ask(
  `No-plaintext-secrets rule (CLAUDE.md): this ${toolName} looks like it contains a real API key/token/` +
  `password literal, not a placeholder. Redirect to Keychain/env var/ssh-copy-id instead, or confirm this ` +
  `is intentional (a test fixture, an already-revoked key) before it lands in a file or a logged command.`
);
