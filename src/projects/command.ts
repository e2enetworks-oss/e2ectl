import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderProjectResult } from './formatter.js';
import {
  ProjectService,
  type ProjectCreateOptions,
  type ProjectListOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildProjectsCommand(runtime: CliRuntime): Command {
  const service = new ProjectService({
    createProjectClient: (credentials) =>
      runtime.createProjectClient(credentials),
    store: runtime.store
  });
  const command = new Command('projects').description(
    'Manage MyAccount projects.'
  );

  command.helpCommand('help [command]', 'Show help for a projects command');

  addContextOptions(
    command
      .command('list')
      .description('List projects for the selected profile.')
  ).action(async (options: ProjectListOptions, commandInstance: Command) => {
    const result = await service.listProjects(options);
    runtime.stdout.write(
      renderProjectResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('create')
      .description('Create a new project.')
      .requiredOption('--name <name>', 'Name of the new project.')
  ).action(async (options: ProjectCreateOptions, commandInstance: Command) => {
    const result = await service.createProject(options);
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
