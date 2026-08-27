#!/usr/bin/env node
const { spawnSyncWithAutoShell } = require('./util');
const fs = require('fs');
const path = require('path');

const SUBTARGETS = ['plugin', 'cli', 'utils', 'scripts'];
let args = process.argv.slice(2);

// If the command is used like `yarn test plugin`, set the --rootDir option to the `plugin` directory
if (SUBTARGETS.includes(args[0])) {
  const target = args[0];
  const targetDir = path.join(process.cwd(), target);
  const restArgs = args.slice(1);
  args = ['--rootDir', target];

  if (fs.existsSync(path.join(targetDir, 'jest.config.js'))) {
    args.push('--config', `${target}/jest.config.js`);
  }
  args.push(...restArgs);
} else if (!args.includes('--config') && !args.includes('-c')) {
  // This package intentionally keeps its transform details in jest.config.cjs.
  // package.json also exposes Expo's preset metadata, so implicit Jest config
  // discovery sees two configs and exits before running a single test.
  args = ['--config', path.join(process.cwd(), 'jest.config.cjs'), ...args];
}

if (
  process.stdout.isTTY &&
  !process.env.CI &&
  !process.env.EXPO_NONINTERACTIVE &&
  !args.includes('--watch')
) {
  args.push('--watch');
}

const result = spawnSyncWithAutoShell('jest', args, { stdio: 'inherit' });
process.exit(result.status ?? 0);
