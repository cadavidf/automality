#!/usr/bin/env node
// automality — PostToolUse hook: after a `git commit`, check the commit
// message for a leaked Claude/Codex/Anthropic/OpenAI attribution and log a
// pass/fail eval record per factory. A leak here means includeCoAuthoredBy
// or the Voice attribution rule silently failed.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveFactory } = require('./automality-factory');

const LEAK_PATTERN = /\b(claude|anthropic|codex|openai)\b|co-authored-by/i;
const EVALS_DIR = path.join(__dirname, '..', 'evals');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^﻿/, ''));
    if (data.tool_name !== 'Bash') return;
    const command = String((data.tool_input && data.tool_input.command) || '');
    if (!/\bgit\s+commit\b/.test(command)) return;

    const cwd = data.cwd || process.cwd();
    const subject = execSync('git log -1 --format=%s', { cwd, encoding: 'utf8' }).trim();
    const body = execSync('git log -1 --format=%B', { cwd, encoding: 'utf8' });
    const sha = execSync('git log -1 --format=%H', { cwd, encoding: 'utf8' }).trim();

    const pass = !LEAK_PATTERN.test(body);
    const factory = resolveFactory(cwd) || 'unknown';

    fs.mkdirSync(EVALS_DIR, { recursive: true });
    const logPath = path.join(EVALS_DIR, factory + '.jsonl');
    const record = {
      ts: new Date().toISOString(),
      factory,
      commit: sha,
      instruction: subject,
      pass,
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');

    if (!pass) {
      process.stderr.write(
        'automality-eval: commit ' + sha.slice(0, 7) + ' (' + factory +
        ') still contains a Claude/Codex/Anthropic/OpenAI attribution string — ' +
        'check includeCoAuthoredBy and the Voice attribution rule.\n'
      );
    }
  } catch (e) {
    // Silent fail — eval logging is best-effort, must never block a commit
  }
});
