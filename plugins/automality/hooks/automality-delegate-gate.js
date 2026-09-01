#!/usr/bin/env node
// Enforces Felipe's "Implementation delegation" rule (CLAUDE.md, 2026-07-27)
// mechanically, at the tool level - instead of relying on the model to keep
// re-applying it turn after turn in a long session.
//
// v1 of this gate (per-call size only, 300-char threshold) failed exactly
// the way it was built to prevent: a session kept making edits that each
// individually stayed under 300 chars while cumulatively doing a large
// amount of hand-implementation (CSS fixes, script rewrites, one after
// another) that should have gone to codex. A per-call check can't see that
// pattern. This version adds a persisted, cumulative running total per
// project directory: once total "small" edit size crosses
// CUMULATIVE_CHARS_LIMIT, the NEXT edit is denied even if it's tiny,
// forcing a delegation checkpoint, then the counter resets.
//
// Fires on Edit/Write to a source-code file. If `codex` or `gemini` is on
// PATH, denies edits/writes (individually large, or cumulatively too much
// small-edit volume) and tells the model to delegate via Bash (e.g.
// `codex exec ...`) instead of writing the code itself.
//
// Neither CLI on PATH -> allow (the documented git-implementor subagent
// fallback applies, unaffected by this gate).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SOURCE_EXTENSIONS = new Set([
  '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.go', '.rs', '.rb',
  '.java', '.c', '.cpp', '.h', '.hpp', '.swift', '.sh', '.php', '.kt',
]);
// Lowered from 300: 300 was easy to stay just under, repeatedly, without
// ever tripping the gate - that's the exact failure mode this exists to
// catch.
const SMALL_EDIT_CHARS = 150;
// Total "small" edit chars allowed through per project before the gate
// forces a delegation checkpoint regardless of individual edit size.
const CUMULATIVE_CHARS_LIMIT = 600;
// Cumulative total resets if the project has been idle this long - a new
// work session gets a fresh allowance rather than inheriting a stale total
// from days ago.
const RESET_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

// Hook subprocesses don't get the login-shell PATH (no .zprofile/.zshrc
// sourcing), so a bare `command -v` here silently says "not found" for
// binaries that only live in a brew-managed dir - which is exactly how this
// gate went dark: node itself failed the same PATH check in the wrapper
// command, so the whole hook no-op'd before ever reaching this function.
// The wrapper now exports these dirs before invoking node (belt), and this
// re-checks them directly (suspenders) so the gate still works even if a
// future edit to the wrapper drops that export.
const EXTRA_PATH_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.local/bin'),
  path.join(os.homedir(), 'bin'),
];

function which(bin) {
  const env = { ...process.env, PATH: `${process.env.PATH || ''}:${EXTRA_PATH_DIRS.join(':')}` };
  try {
    execSync(`command -v ${bin}`, { stdio: ['ignore', 'ignore', 'ignore'], env });
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

function statePath(cwd) {
  const key = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `automality-delegate-gate-${key}.json`);
}

function readCumulative(cwd) {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(cwd), 'utf8'));
    if (Date.now() - raw.updatedAt > RESET_AFTER_MS) return 0;
    return raw.cumulative || 0;
  } catch {
    return 0;
  }
}

function writeCumulative(cwd, cumulative) {
  try {
    fs.writeFileSync(statePath(cwd), JSON.stringify({ cumulative, updatedAt: Date.now() }));
  } catch {
    // Best-effort - a state-write failure shouldn't block the edit.
  }
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

const codexAvailable = which('codex');
const geminiAvailable = !codexAvailable && which('gemini');
if (!codexAvailable && !geminiAvailable) {
  allow();
}
const tool = codexAvailable ? 'codex' : 'gemini';

if (editSize >= SMALL_EDIT_CHARS) {
  writeCumulative(cwd, 0);
  deny(
    `Implementation delegation rule (CLAUDE.md, 2026-07-27): ${tool} is on PATH and this is a ` +
    `${editSize}-char ${toolName} to ${filePath || '(unknown file)'} - that's implementation work, ` +
    `which goes to ${tool} via Bash (e.g. \`${tool} exec ...\`), not a direct ${toolName}. ` +
    `Plan/describe the change, then delegate it and review the result. Small targeted fixes under ` +
    `${SMALL_EDIT_CHARS} chars (typos, single config values) still go through directly.`
  );
}

const priorCumulative = readCumulative(cwd);
const newCumulative = priorCumulative + editSize;
if (newCumulative >= CUMULATIVE_CHARS_LIMIT) {
  writeCumulative(cwd, 0);
  deny(
    `Implementation delegation rule (CLAUDE.md, 2026-07-27): this edit is only ${editSize} chars, ` +
    `but small edits to this project have added up to ${newCumulative} chars without a delegation ` +
    `checkpoint - that's the "many small edits instead of one delegated task" pattern this gate ` +
    `exists to catch. ${tool} is on PATH. Stop, plan the remaining work as one piece, and delegate ` +
    `it via Bash (e.g. \`${tool} exec ...\`) instead of continuing to hand-edit.`
  );
}

writeCumulative(cwd, newCumulative);
allow();
