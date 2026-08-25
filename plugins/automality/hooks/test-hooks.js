#!/usr/bin/env node
// Self-check: catches a broken rename/config edit before it reaches a
// session. Run: node hooks/test-hooks.js
const assert = require('assert');
const { normalizeMode, DEFAULT_MODE } = require('./automality-config');
const { getAutomalityInstructions } = require('./automality-instructions');

assert.strictEqual(DEFAULT_MODE, 'full');
assert.strictEqual(normalizeMode('lite'), 'lite');
assert.strictEqual(normalizeMode('nonsense-mode'), null);

const full = getAutomalityInstructions('full');
assert.ok(full.includes('AUTOMALITY MODE ACTIVE'), 'missing activation banner');
assert.ok(!/ponytail/i.test(full), 'stale "ponytail" naming leaked into instructions');
assert.ok(!/lazy senior/i.test(full), 'stale "lazy senior" framing leaked into instructions');

console.log('automality hooks: OK');
