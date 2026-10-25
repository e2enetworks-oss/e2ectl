import { Command } from 'commander';

import { addTirContextOptions } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { formatTirCommand } from '../api.js';
import { renderTirPlanResult } from './formatter.js';
import { TirPlanService } from './service.js';
import type { TirPlanContextOptions } from './types.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildTirPlanCommand(runtime: CliRuntime): Command {
  const service = new TirPlanService({
    createTirPlanClient: (credentials) =>
      runtime.createTirPlanClient(credentials),
    store: runtime.store
  });
  const command = new Command('plan').description(
    'List the plans TIR instances can run on.'
  );

  command.helpCommand('help [command]', 'Show help for a tir plan command');

  addTirContextOptions(
    command
      .command('list')
      .description(
        'List CPU and GPU plans with their hourly and committed plan ids. Pass --image-version-id to see only the plans that fit an image.'
      )
      .option(
        '--image-version-id <imageVersionId>',
        'Image version id from tir image list.'
      )
      .addHelpText(
        'after',
        `\nExamples:\n  ${formatTirCommand('plan list')}\n  ${formatTirCommand('plan list --image-version-id 12 --json')}\n`
      )
  ).action(async (options: TirPlanContextOptions, commandInstance: Command) => {
    const result = await service.list(options);
    runtime.stdout.write(
      renderTirPlanResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
