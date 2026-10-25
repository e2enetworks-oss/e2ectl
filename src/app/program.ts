import { Command } from 'commander';

import { CLI_COMMAND_NAME, CLI_VERSION } from './metadata.js';
import { buildConfigCommand } from '../config/index.js';
import { buildMyAccountCommand } from '../myaccount/index.js';
import { buildConfigureCommand } from './configure.js';
import { createRuntime, type CliRuntime } from './runtime.js';
import { buildTirCommand } from '../tir/index.js';

export function createProgram(runtime: CliRuntime = createRuntime()): Command {
  const program = new Command();

  program
    .name(CLI_COMMAND_NAME)
    .description('CLI for E2E Networks.')
    .version(CLI_VERSION)
    .option('--json', 'Emit deterministic JSON output; errors too. Never asks.')
    .option(
      '--no-input',
      'Never ask questions: fail and name the flag to add instead.'
    )
    .showSuggestionAfterError()
    .showHelpAfterError('(use --help for usage)');

  // Scripts and agents: with --json or --no-input nothing waits for an
  // answer, even inside a terminal.
  program.hook('preAction', () => {
    const options = program.opts<{ input?: boolean; json?: boolean }>();
    if (options.json === true || options.input === false) {
      runtime.isInteractive = false;
    }
  });

  program.addCommand(buildConfigureCommand(runtime));
  program.addCommand(buildConfigCommand(runtime));
  program.addCommand(buildMyAccountCommand(runtime));
  program.addCommand(buildTirCommand(runtime));
  program.helpCommand('help [command]', 'Show help for a command');

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
