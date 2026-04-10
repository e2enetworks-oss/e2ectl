import { Command } from 'commander';

import { CLI_COMMAND_NAME, CLI_VERSION } from './metadata.js';
import { buildConfigCommand } from '../config/index.js';
import { buildNodeCommand } from '../node/index.js';
import { buildSshKeyCommand } from '../ssh-key/index.js';
import { buildVolumeCommand } from '../volume/index.js';
import { buildVpcCommand } from '../vpc/index.js';
import { createRuntime, type CliRuntime } from './runtime.js';

export function createProgram(runtime: CliRuntime = createRuntime()): Command {
  const program = new Command();

  program
    .name(CLI_COMMAND_NAME)
    .description('CLI for the E2E Networks MyAccount platform.')
    .version(CLI_VERSION)
    .option('--json', 'Emit deterministic JSON output.')
    .showSuggestionAfterError()
    .showHelpAfterError('(use --help for usage)');

  program.addCommand(buildConfigCommand(runtime));
  program.addCommand(buildNodeCommand(runtime));
  program.addCommand(buildVolumeCommand(runtime));
  program.addCommand(buildVpcCommand(runtime));
  program.addCommand(buildSshKeyCommand(runtime));
  program.helpCommand('help [command]', 'Show help for a command');

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
