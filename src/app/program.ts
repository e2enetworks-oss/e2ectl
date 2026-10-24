import { Command } from 'commander';

import { CLI_COMMAND_NAME, CLI_VERSION } from './metadata.js';
import { buildConfigCommand } from '../config/index.js';
import { buildMyAccountCommand } from '../myaccount/index.js';
import { createRuntime, type CliRuntime } from './runtime.js';

export function createProgram(runtime: CliRuntime = createRuntime()): Command {
  const program = new Command();

  program
    .name(CLI_COMMAND_NAME)
    .description('CLI for E2E Networks.')
    .version(CLI_VERSION)
    .option('--json', 'Emit deterministic JSON output.')
    .showSuggestionAfterError()
    .showHelpAfterError('(use --help for usage)');

  program.addCommand(buildConfigCommand(runtime));
  program.addCommand(buildMyAccountCommand(runtime));
  program.helpCommand('help [command]', 'Show help for a command');

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
