# Changelog

## 1.1.0 — 2026-08-27

- Added `automality-delegate-gate.js`, a `PreToolUse` hook on `Edit`/`Write`
  that mechanically enforces the "Implementation delegation" rule: denies
  non-trivial (≥300 char) writes to source files when `codex` or `gemini` is
  on PATH, with a reason telling the model to delegate via Bash instead.
  Small targeted fixes still go through directly. Added because a session
  spent many turns hand-editing render/CSS code with codex sitting unused on
  PATH the whole time - the rule existed in CLAUDE.md but nothing enforced
  it once a session got deep into an iterative edit loop.

## 1.0.0 — 2026-08-24

- Renamed the persona from **ponytail** to **automality** across all hooks,
  commands, and skills (`ponytail-*` → `automality-*`; `.ponytail-active` →
  `.automality-active`).
- Removed "lazy senior developer" framing; reworded to minimal-first
  engineering language throughout.
- Added README, logo, LICENSE (MIT).

## 0.1.0 — 2026-08-17

- Initial marketplace: git-implementor and pitch-reviewer agents.
- Ported ponytail hooks/skills/commands into the plugin.

## 1.2.0 — 2026-08-27

- Fixed `automality-delegate-gate.js`: the v1.1.0 gate only checked
  per-call edit size (300-char threshold), which a session repeatedly
  stayed just under while cumulatively doing a large amount of
  hand-implementation across many small edits - exactly the pattern the
  gate was supposed to prevent. Added persisted, per-project cumulative
  tracking (600-char running total, 2hr idle reset): once small edits add
  up past the limit, the next one is denied regardless of its own size,
  forcing a real delegation checkpoint. Lowered the per-call threshold
  300->150 too.
