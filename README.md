<p align="center">
  <img src="assets/logo.svg" alt="Automality" width="360">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2dd4bf.svg"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-3b82f6.svg">
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/claude--code-plugin-black.svg">
</p>

A Claude Code plugin marketplace for Felipe Cadavid's custom tooling: a
minimal-first engineering persona (**automality**) that fights
over-engineering by default, plus two task agents.

## What's in it

### automality — the persona
Injected automatically at the start of every session. Before writing code it
walks a ladder and stops at the first rung that holds:

1. Does this need to exist at all? (YAGNI)
2. Does the standard library do it?
3. Does a native platform feature cover it?
4. Does an already-installed dependency solve it?
5. Can it be one line?
6. Only then: the minimum code that works.

No unrequested abstractions, no boilerplate "for later," shortest working
diff. Deliberate shortcuts get marked with an `automality:` comment naming
the ceiling and the upgrade path, instead of silently cutting corners.
Never simplifies away input validation, error handling, security, or
accessibility.

Three intensity levels — `lite`, `full` (default), `ultra` — switchable with
`/automality lite|full|ultra`, or set a default via the
`AUTOMALITY_DEFAULT_MODE` env var or `~/.config/automality/config.json`.

| Command | What it does |
|---|---|
| `/automality [level]` | Switch intensity, or reactivate after `off` |
| `/automality-review` | Over-engineering review of the current diff |
| `/automality-audit` | Whole-repo over-engineering audit |
| `/automality-debt` | Harvest every `automality:` comment into a debt ledger |
| `/automality-gain` | Measured-impact scoreboard (lines, cost, speed) |
| `/automality-help` | Quick reference card |

### Agents
- **git-implementor** — fallback implementer for when both `codex` and
  `gemini` CLIs are unavailable on `PATH`. Runs a short intake, works in a
  git-tracked folder, promotes the finished result once confirmed.
- **pitch-reviewer** — reviews a startup pitch deck or exec summary for
  investor-readiness: fabricated claims, weak "why now," inconsistent
  numbers, generic boilerplate.

## Install

```
/plugin marketplace add cadavidf/automality-plugin
/plugin install automality@automality
```

## Structure

```
plugins/automality/
├── agents/     # git-implementor, pitch-reviewer
├── commands/   # /automality and friends
├── skills/     # matching skill definitions
├── hooks/      # SessionStart activation, statusline, mode tracking
└── factories/  # per-project routing/guidance
```

## License

[MIT](LICENSE)
