---
name: automality-help
description: >
  Quick-reference card for all automality modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /automality-help,
  "automality help", "what automality commands", "how do I use automality".
---

# Automality Help

Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | `/automality lite` | Build what's asked, name the lazier alternative in one line. |
| **Full** | `/automality` | The ladder enforced: YAGNI → stdlib → native → one line → minimum. Default. |
| **Ultra** | `/automality ultra` | YAGNI extremist. Deletion before addition. Challenges requirements before building. |

Level sticks until changed or session end.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **automality** | `/automality` | The persona itself. Simplest solution that works. |
| **automality-review** | `/automality-review` | Over-engineering review: `L42: yagni: factory, one product. Inline.` |
| **automality-gain** | `/automality-gain` | Measured-impact scoreboard: less code, less cost, more speed. |
| **automality-help** | `/automality-help` | This card. |

Codex uses `@automality`, `@automality-review`, and `@automality-help`; Claude Code
and OpenCode use the slash-command forms above (OpenCode ships `/automality` and
`/automality-review`).

## Deactivate

Say "stop automality" or "normal mode". Resume anytime with `/automality`.
`/automality off` also works.

## Configure Default Mode

Default mode = `full`, auto-active every session. Change it:

**Environment variable** (highest priority):
```bash
export AUTOMALITY_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/automality/config.json`, Windows: `%APPDATA%\automality\config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start, activate manually
with `/automality` when wanted.

Resolution: env var > config file > `full`.

## Update

Enable auto-update once: open `/plugin`, go to Marketplaces, pick automality, Enable auto-update. Claude Code then pulls new versions at startup (run `/reload-plugins` when it prompts). Manual refresh: `/plugin marketplace update automality` then `/reload-plugins`.

If `/plugin` is not recognized, your Claude Code is out of date. Update it (`npm install -g @anthropic-ai/claude-code@latest`, or `brew upgrade claude-code`) and restart. Other hosts use their own update flow.

## More

Full docs + examples: https://github.com/DietrichGebert/automality
