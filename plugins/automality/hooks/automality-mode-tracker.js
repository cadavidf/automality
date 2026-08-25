#!/usr/bin/env node
// automality — UserPromptSubmit hook to track which automality mode is active
// Inspects user input for /automality commands and writes mode to flag file

const { getDefaultMode, isDeactivationCommand } = require('./automality-config');
const { clearMode, setMode, writeHookOutput } = require('./automality-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /automality commands
    if (/^[/@$]automality/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/automality-review' || cmd === '/automality:automality-review') {
        mode = 'review';
      } else if (cmd === '/automality' || cmd === '/automality:automality') {
        if (arg === 'lite') mode = 'lite';
        else if (arg === 'full') mode = 'full';
        else if (arg === 'ultra') mode = 'ultra';
        else if (arg === 'off') mode = 'off';
        else mode = getDefaultMode();
      }

      if (mode && mode !== 'off') {
        setMode(mode);
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'AUTOMALITY MODE CHANGED — level: ' + mode,
        );
      } else if (mode === 'off') {
        clearMode();
        writeHookOutput('UserPromptSubmit', 'off', 'AUTOMALITY MODE OFF');
      }
    }

    // Detect deactivation
    if (isDeactivationCommand(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'AUTOMALITY MODE OFF');
    }
  } catch (e) {
    // Silent fail
  }
});
