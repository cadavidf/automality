#!/usr/bin/env node
// automality — resolves which factory a cwd belongs to, from factories/routes.json.
// Path-based routing: longest-matching prefix wins if a cwd sits under two.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROUTES_PATH = path.join(__dirname, '..', 'factories', 'routes.json');
const GUIDANCE_PATH = path.join(__dirname, '..', 'factories', 'guidance.json');

function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function loadRoutes() {
  try {
    return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

// Optional per-factory guidance text (e.g. which CLI/flags to use for a
// "book" run) -- keyed by factory name, same as routes.json. Absent for
// factories with nothing specific to say yet; that's fine, not an error.
function loadGuidance() {
  try {
    return JSON.parse(fs.readFileSync(GUIDANCE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function getFactoryGuidance(factory) {
  if (!factory) return null;
  return loadGuidance()[factory] || null;
}

function resolveFactory(cwd) {
  const routes = loadRoutes();
  const target = path.resolve(cwd || process.cwd());
  let best = null; // { factory, prefixLen }

  for (const [factory, prefixes] of Object.entries(routes)) {
    for (const prefix of prefixes) {
      const abs = path.resolve(expandHome(prefix));
      if (target === abs || target.startsWith(abs + path.sep)) {
        if (!best || abs.length > best.prefixLen) {
          best = { factory, prefixLen: abs.length };
        }
      }
    }
  }

  return best ? best.factory : null;
}

module.exports = { resolveFactory, loadRoutes, getFactoryGuidance, ROUTES_PATH, GUIDANCE_PATH };
