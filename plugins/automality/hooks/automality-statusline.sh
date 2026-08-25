#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.automality-active"
[ -f "$flag" ] || exit 0

mode=$(head -n1 "$flag" | tr -d '[:space:]')

# teal->blue pulse: color shifts each second the statusline redraws
colors=(23 30 37 44 37 30)
color=${colors[$(( $(date +%s) % ${#colors[@]} ))]}

if [ -z "$mode" ] || [ "$mode" = "full" ]; then
    printf '\033[38;5;%sm[AUTOMALITY]\033[0m' "$color"
else
    printf '\033[38;5;%sm[AUTOMALITY:%s]\033[0m' "$color" "$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')"
fi
