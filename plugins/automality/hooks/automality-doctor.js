#!/usr/bin/env node
// automality — self-test harness for every hook wired in claude-codex-hooks.json.
//
// Exists because the delegate-gate went silently dark for weeks: every
// node-based hook's wrapper command guards with `command -v node`, and when
// that check fails the wrapper falls through to `|| exit 0` with zero
// output — indistinguishable from "correctly decided to allow" unless you
// go looking. This script goes looking, deterministically, so a broken
// hook shows up as a failed assertion instead of an absence nobody notices.
//
// Each hook is invoked through its REAL wrapper command (parsed straight out
// of claude-codex-hooks.json, not reimplemented here) under a deliberately
// stripped PATH (/usr/bin:/bin — no /opt/homebrew/bin, no /usr/local/bin).
// That's not an arbitrary stress test: it's the exact condition that broke
// the delegate-gate for weeks on a machine where node/codex/gemini only
// resolve via a brew-managed dir. If the wrapper's own PATH export (see
// claude-codex-hooks.json) is ever dropped or narrowed in a future edit,
// this is what catches it.
//
// Run directly: node automality-doctor.js
// (the /automality-doctor command just runs this and reports the output
// verbatim — the pass/fail logic lives here, not in a prompt, so results
// don't depend on the model interpreting anything.)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const PLUGIN_ROOT = path.join(__dirname, '..');
const HOOKS_CONFIG = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'hooks', 'claude-codex-hooks.json'), 'utf8'));
// The exact adverse PATH that caused the real outage: bare POSIX dirs only,
// no brew-managed bin dir where node/codex/gemini actually live here.
const STRIPPED_PATH = '/usr/bin:/bin';

let pass = 0;
let fail = 0;
const lines = [];

function record(name, ok, detail) {
  if (ok) pass++; else fail++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// Pull every {event, command} pair out of the hooks config, keyed by which
// script file the command invokes — so this stays correct if hooks are
// added/reordered/reworded, instead of hardcoding wrapper strings here too.
function findWrapper(scriptFilename) {
  for (const event of Object.keys(HOOKS_CONFIG.hooks)) {
    for (const group of HOOKS_CONFIG.hooks[event]) {
      for (const hook of group.hooks) {
        if (hook.type === 'command' && hook.command.includes(scriptFilename)) {
          return { event, command: hook.command };
        }
      }
    }
  }
  return null;
}

// spawnSync, not execSync: execSync only returns stdout on a zero exit and
// silently discards stderr in that case — which is exactly the case that
// matters for automality-eval.js (it always exits 0, warning or not, so its
// warning lives only on stderr). Caught this the hard way: this doctor's
// first run reported a false FAIL because execSync threw the real stderr
// away before this function ever saw it.
function runWrapper(command, { stdin = '', cwd = PLUGIN_ROOT, extraEnv = {} } = {}) {
  const resolved = command.replaceAll('${CLAUDE_PLUGIN_ROOT}', PLUGIN_ROOT);
  const result = spawnSync('/bin/sh', ['-c', resolved], {
    cwd,
    input: stdin,
    env: { PATH: STRIPPED_PATH, HOME: os.homedir(), ...extraEnv },
    encoding: 'utf8',
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', code: result.status ?? 1 };
}

function testGate(scriptFilename, label, stdin, expectSubstring) {
  const wrapper = findWrapper(scriptFilename);
  if (!wrapper) {
    record(label, false, `no wrapper found for ${scriptFilename} in claude-codex-hooks.json`);
    return;
  }
  const { stdout, code } = runWrapper(wrapper.command, { stdin });
  const ok = code === 0 && stdout.includes(expectSubstring);
  record(label, ok, ok ? undefined : `wrapper exited ${code}, stdout: ${stdout.slice(0, 200) || '(empty)'}`);
}

function testSmoke(scriptFilename, label, stdin) {
  const wrapper = findWrapper(scriptFilename);
  if (!wrapper) {
    record(label, false, `no wrapper found for ${scriptFilename}`);
    return;
  }
  const { code, stderr } = runWrapper(wrapper.command, { stdin });
  // Smoke tests only assert "didn't crash" — these hooks have side effects
  // (writing .automality-active, etc.) that are fine to actually trigger
  // with a neutral/no-op input, but there's nothing meaningful to assert
  // about their content without depending on machine-specific state.
  record(label, code === 0, code === 0 ? undefined : `exited ${code}, stderr: ${stderr.slice(0, 200)}`);
}

// -- delegate-gate: the hook that actually broke. A large Edit to a .swift
// file with codex/gemini on PATH (checked independently below, not assumed)
// must be denied and must name the tool to delegate to.
const codexOrGemini = (() => {
  try { execSync('command -v codex', { shell: '/bin/sh', env: { PATH: process.env.PATH } }); return 'codex'; } catch {}
  try { execSync('command -v gemini', { shell: '/bin/sh', env: { PATH: process.env.PATH } }); return 'gemini'; } catch {}
  return null;
})();

if (codexOrGemini) {
  testGate(
    'automality-delegate-gate.js',
    'delegate-gate: denies a large Edit when ' + codexOrGemini + ' is on PATH',
    JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: '/tmp/doctor-test/ContentView.swift', old_string: 'x', new_string: 'y'.repeat(300) },
      cwd: '/tmp/doctor-test',
    }),
    '"permissionDecision":"deny"'
  );
} else {
  record('delegate-gate: denies a large Edit', true, 'skipped — neither codex nor gemini on PATH on this machine, gate correctly no-ops');
}

// -- pricing-guard: a $ figure under a quote-factory path must ask.
testGate(
  'automality-pricing-guard.js',
  'pricing-guard: asks on a $ figure under quote-factory',
  JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: '/tmp/doctor-test/quote-factory/customers/x.json', old_string: 'a', new_string: '"price": "$1,500,000"' },
    cwd: '/tmp/doctor-test/quote-factory',
  }),
  '"permissionDecision":"ask"'
);

// -- secret-guard: a fake but well-formed API key literal must ask.
testGate(
  'automality-secret-guard.js',
  'secret-guard: asks on a plausible secret literal',
  JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'curl -H "Authorization: Bearer sk-ant-api03-DOCTORTESTFAKEKEYDOCTORTEST" https://api.example.com' },
  }),
  '"permissionDecision":"ask"'
);

// -- activate / mode-tracker: smoke only, no meaningful assertion beyond
// "the wrapper's PATH export makes node resolve and the script runs clean".
testSmoke('automality-activate.js', 'activate: runs clean under a stripped PATH', '{}');
testSmoke('automality-mode-tracker.js', 'mode-tracker: runs clean on an ordinary prompt', JSON.stringify({ prompt: 'just an ordinary message, not a command' }));

// -- eval.js: needs a real git repo, since it shells out to `git log`.
// Isolated temp repo, cleaned up unconditionally afterward.
(function testEval() {
  const wrapper = findWrapper('automality-eval.js');
  if (!wrapper) { record('eval.js', false, 'no wrapper found'); return; }

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'automality-doctor-eval-'));
  try {
    execSync('git init -q && git config user.email doctor@automality.test && git config user.name "Automality Doctor"', { cwd: repo, shell: '/bin/sh' });
    fs.writeFileSync(path.join(repo, 'f.txt'), 'x');
    execSync('git add f.txt', { cwd: repo, shell: '/bin/sh' });

    // Clean commit -> should record pass:true, no stderr warning.
    execSync('git commit -q -m "Clean commit, no leak"', { cwd: repo, shell: '/bin/sh' });
    const cleanResult = runWrapper(wrapper.command, {
      cwd: repo,
      stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "Clean commit, no leak"' }, cwd: repo }),
    });
    record('eval.js: clean commit produces no leak warning', cleanResult.stderr === '', cleanResult.stderr && `unexpected stderr: ${cleanResult.stderr.slice(0, 200)}`);

    // Leaked commit -> should warn on stderr.
    fs.writeFileSync(path.join(repo, 'f.txt'), 'y');
    execSync('git add f.txt', { cwd: repo, shell: '/bin/sh' });
    execSync('git commit -q -m "Leaky commit" -m "Co-Authored-By: Claude <noreply@anthropic.com>"', { cwd: repo, shell: '/bin/sh' });
    const leakResult = runWrapper(wrapper.command, {
      cwd: repo,
      stdin: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "Leaky commit"' }, cwd: repo }),
    });
    record('eval.js: leaked attribution produces a warning', leakResult.stderr.includes('attribution'), leakResult.stderr ? undefined : 'no stderr warning emitted');
  } catch (e) {
    record('eval.js', false, `test setup failed: ${e.message}`);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    // The hook writes into the plugin's own evals/ dir regardless of test
    // repo location (path is fixed relative to __dirname, not cwd) — trim
    // back off whatever this run appended so doctor runs stay side-effect
    // free on the real eval log.
    try {
      const evalsFile = path.join(PLUGIN_ROOT, 'evals', 'unknown.jsonl');
      const before = fs.existsSync(evalsFile) ? fs.readFileSync(evalsFile, 'utf8').split('\n').filter(Boolean) : [];
      const trimmed = before.filter((line) => !line.includes('doctor@automality.test') && !line.includes('Clean commit, no leak') && !line.includes('Leaky commit'));
      if (trimmed.length !== before.length) {
        fs.writeFileSync(evalsFile, trimmed.length ? trimmed.join('\n') + '\n' : '');
      }
    } catch {
      // Best-effort cleanup — a failure here shouldn't fail the doctor run.
    }
  }
})();

console.log(lines.join('\n'));
console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
