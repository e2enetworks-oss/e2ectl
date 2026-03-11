import { Command } from 'commander';
import { createRequire } from 'node:module';

import { buildConfigCommand } from '../config/index.js';
import { buildNodeCommand } from '../node/index.js';
import { createRuntime, type CliRuntime } from './runtime.js';

interface PackageMetadata {
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as PackageMetadata;

export function createProgram(runtime: CliRuntime = createRuntime()): Command {
  const program = new Command();

  program
    .name('e2ectl')
    .description('CLI for the E2E Networks MyAccount platform.')
    .version(packageMetadata.version)
    .option('--json', 'Emit deterministic JSON output.')
    .showSuggestionAfterError()
    .showHelpAfterError('(use --help for usage)');

  program.addCommand(buildConfigCommand(runtime));
  program.addCommand(buildNodeCommand(runtime));
  program.helpCommand('help [command]', 'Show help for a command');

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
