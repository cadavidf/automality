#!/usr/bin/env node
// automality — PreToolUse hook enforcing Felipe's "ask before pricing
// decisions" rule (CLAUDE.md): never invent/change a real $ figure or
// billing structure on a live client quote without confirming first.
//
// Scope is deliberately narrow: only Edit/Write to a path under a
// directory literally named "quote-factory" (the one repo this rule names),
// and only when the changed text looks like it touches a currency figure.
// Everywhere else this hook is a no-op.
//
// Unlike automality-delegate-gate.js, this doesn't deny — it can't tell
// "already confirmed with Felipe earlier in this chat" from "about to slip
// one past him", and a hook only sees the tool call, not the conversation.
// So it asks: permissionDecision "ask" routes through Claude Code's normal
// permission prompt, putting an actual human in the loop, same mechanism as
// the existing Artifact PreToolUse hook in settings.json.

const fs = require('fs');

const QUOTE_FACTORY_PATH = /quote-factory/i;
// Deliberately narrow to avoid false positives on ordinary code: an
// explicit currency mark, a Colombian-peso mention, or a price/fee/cost
// keyword immediately followed by an assignment/colon. A bare "total" or
// "amount" elsewhere in the file (a loop counter, an image count) does not
// match this — those aren't money.
const CURRENCY_PATTERN = /\$\s?\d[\d,.]*|\bCOP\b|\b(precio|tarifa|price|fee|cost|amount)\s*[:=]/i;

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
  return;
}

const toolName = input.tool_name;
const toolInput = input.tool_input || {};
const filePath = toolInput.file_path || '';
const cwd = input.cwd || process.cwd();

if (!['Edit', 'Write'].includes(toolName)) {
  allow();
}

if (!QUOTE_FACTORY_PATH.test(filePath) && !QUOTE_FACTORY_PATH.test(cwd)) {
  allow();
}

let changed = '';
if (toolName === 'Edit') {
  changed = String(toolInput.old_string || '') + '\n' + String(toolInput.new_string || '');
} else if (toolName === 'Write') {
  changed = String(toolInput.content || '');
}

if (!CURRENCY_PATTERN.test(changed)) {
  allow();
}

ask(
  `Ask-before-pricing rule (CLAUDE.md): this ${toolName} to ${filePath || '(unknown file)'} in quote-factory ` +
  `looks like it touches a $ figure or billing structure. Confirm the exact number/structure with Felipe ` +
  `before this lands on a live client quote.`
);
