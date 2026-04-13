import { Command } from 'commander';

import { addAliasOption } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderProjectResult } from './formatter.js';
import { ProjectService, type ProjectContextOptions } from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildProjectCommand(runtime: CliRuntime): Command {
  const service = new ProjectService({
    createProjectClient: (credentials) =>
      runtime.createProjectClient(credentials),
    store: runtime.store
  });
  const command = new Command('project').description(
    'Inspect account-level MyAccount project access.'
  );

  command.helpCommand('help [command]', 'Show help for a project command');

  addAliasOption(
    command
      .command('list')
      .description(
        'List accessible projects for the selected account without requiring project/location context.'
      )
  ).action(async (options: ProjectContextOptions, commandInstance: Command) => {
    const result = await service.listProjects(options);
    runtime.stdout.write(
      renderProjectResult(
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
