import { Command } from 'commander';

import type { CliRuntime } from '../app/runtime.js';
import { buildTirAccountCommand } from './account/index.js';
import {
  buildTirConfigureCommand,
  buildTirProjectCommand
} from './project/index.js';

export function buildTirCommand(runtime: CliRuntime): Command {
  const command = new Command('tir').description(
    'Manage E2E TIR (AI platform) resources. Start with tir account list, tir project list and tir configure.'
  );

  command.helpCommand('help [command]', 'Show help for a tir command');

  command.addCommand(buildTirAccountCommand(runtime));
  command.addCommand(buildTirProjectCommand(runtime));
  command.addCommand(buildTirConfigureCommand(runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
