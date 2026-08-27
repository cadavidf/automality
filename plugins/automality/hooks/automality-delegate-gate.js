#!/usr/bin/env node
// Enforces Felipe's "Implementation delegation" rule (CLAUDE.md, 2026-07-27)
// mechanically, at the tool level - instead of relying on the model to keep
// re-applying it turn after turn in a long session. That's exactly how a
// session drifted: it started as "look at the rendered PDF, tweak, re-render"
// and each follow-up request extended the same loop without ever stopping to
// check codex/gemini and delegate, even once the asks became a real
// multi-file refactor (design tokens, CSS compiler, QR component).
//
// Fires on Edit/Write to a source-code file. If `codex` or `gemini` is on
// PATH, denies non-trivial edits/writes and tells the model to delegate via
// Bash (e.g. `codex exec ...`) instead of writing the code itself. Small,
// targeted edits (below SMALL_EDIT_CHARS) still go through directly - this
// gate is about implementation work, not a one-line fix or a config value.
//
// Neither CLI on PATH -> allow (the documented git-implementor subagent
// fallback applies, unaffected by this gate).

const fs = require('fs');
const { execSync } = require('child_process');

const SOURCE_EXTENSIONS = new Set([
  '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.go', '.rs', '.rb',
  '.java', '.c', '.cpp', '.h', '.hpp', '.swift', '.sh', '.php', '.kt',
]);
const SMALL_EDIT_CHARS = 300;

function which(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function allow() {
  respond({});
}

function deny(reason) {
  respond({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
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
const dot = filePath.lastIndexOf('.');
const ext = dot >= 0 ? filePath.slice(dot) : '';

if (!['Edit', 'Write'].includes(toolName) || !SOURCE_EXTENSIONS.has(ext)) {
  allow();
}

let editSize = 0;
if (toolName === 'Edit') {
  editSize = (toolInput.old_string || '').length + (toolInput.new_string || '').length;
} else if (toolName === 'Write') {
  editSize = (toolInput.content || '').length;
}
if (editSize < SMALL_EDIT_CHARS) {
  allow();
}

const codexAvailable = which('codex');
const geminiAvailable = !codexAvailable && which('gemini');

if (!codexAvailable && !geminiAvailable) {
  allow();
}

const tool = codexAvailable ? 'codex' : 'gemini';
deny(
  `Implementation delegation rule (CLAUDE.md, 2026-07-27): ${tool} is on PATH and this is a ` +
  `${editSize}-char ${toolName} to ${filePath || '(unknown file)'} - that's implementation work, ` +
  `which goes to ${tool} via Bash (e.g. \`${tool} exec ...\`), not a direct ${toolName}. ` +
  `Plan/describe the change, then delegate it and review the result. Small targeted fixes under ` +
  `${SMALL_EDIT_CHARS} chars (typos, single config values) still go through directly.`
);
