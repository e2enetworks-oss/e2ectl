import { Command } from 'commander';

import { addAliasOption } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/index.js';
import { renderPlatformSetupResult } from '../../config/index.js';
import { formatMyAccountCommand } from '../api.js';
import { configureMyAccount } from './configure.js';
import { renderProjectResult } from './formatter.js';
import {
  ProjectService,
  type ProjectContextOptions,
  type ProjectCreateOptions,
  type ProjectStarOptions
} from './service.js';

interface MyAccountConfigureOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

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
    'Manage account-scoped MyAccount projects.'
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

  addAliasOption(
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

  addAliasOption(
    command
      .command('star <projectId>')
      .description('Star a project by its numeric id.')
  ).action(
    async (
      projectId: string,
      options: ProjectStarOptions,
      commandInstance: Command
    ) => {
      const result = await service.starProject(projectId, options);
      runtime.stdout.write(
        renderProjectResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addAliasOption(
    command
      .command('unstar <projectId>')
      .description('Unstar a project by its numeric id.')
  ).action(
    async (
      projectId: string,
      options: ProjectStarOptions,
      commandInstance: Command
    ) => {
      const result = await service.unstarProject(projectId, options);
      runtime.stdout.write(
        renderProjectResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

export function buildMyAccountConfigureCommand(runtime: CliRuntime): Command {
  return addAliasOption(
    new Command('configure')
      .description(
        'Choose the MyAccount project and location and save them in the profile. Every later myaccount command uses them unless a flag or E2E_PROJECT_ID/E2E_LOCATION says otherwise. Asks in a terminal; give the flags in scripts.'
      )
      .option(
        '--project-id <projectId>',
        'MyAccount project id (from myaccount project list).'
      )
      .option('--location <location>', 'Delhi or Chennai.')
      .addHelpText(
        'after',
        `\nExample:\n  ${formatMyAccountCommand('configure --project-id 46 --location Chennai')}\n`
      )
  ).action(
    async (options: MyAccountConfigureOptions, commandInstance: Command) => {
      const json =
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false;
      const result = await configureMyAccount(runtime, {
        alias: options.alias,
        canPrompt: runtime.isInteractive && !json,
        flagPrefix: '',
        values: { location: options.location, project: options.projectId }
      });
      runtime.stdout.write(renderPlatformSetupResult(result, json));
    }
  );
}
