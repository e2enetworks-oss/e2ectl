import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderDbaasResult } from './formatter.js';
import {
  DbaasService,
  type DbaasCreateOptions,
  type DbaasDeleteOptions,
  type DbaasListOptions,
  type DbaasPlansOptions,
  type DbaasResetPasswordOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildDbaasCommand(runtime: CliRuntime): Command {
  const service = new DbaasService({
    confirm: (message) => runtime.confirm(message),
    createDbaasClient: (credentials) => {
      if (runtime.createDbaasClient === undefined) {
        throw new Error('DBaaS client support is unavailable in this runtime.');
      }

      return runtime.createDbaasClient(credentials);
    },
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('dbaas').description(
    'Manage MyAccount MariaDB, MySQL, and PostgreSQL DBaaS clusters.'
  );

  command.helpCommand('help [command]', 'Show help for a dbaas command');

  addContextOptions(
    command
      .command('plans')
      .description(
        'Discover supported DBaaS engines, versions, and template plans before creation.'
      )
      .option(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .option(
        '--db-version <version>',
        'Database engine version. Requires --type.'
      )
  ).action(async (options: DbaasPlansOptions, commandInstance: Command) => {
    const result = await service.listPlans(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('list')
      .description(
        'List supported DBaaS clusters for the selected profile or environment credentials.'
      )
      .option(
        '--type <databaseType>',
        'Filter by database type: maria, sql, or postgres.'
      )
  ).action(async (options: DbaasListOptions, commandInstance: Command) => {
    const result = await service.listDbaas(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('create')
      .description(
        `Create a DBaaS cluster. Inspect ${formatCliCommand('dbaas plans')} first so the CLI can resolve the backend software and template ids safely.`
      )
      .requiredOption('--name <name>', 'DBaaS cluster name.')
      .requiredOption(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .requiredOption('--db-version <version>', 'Database engine version.')
      .requiredOption(
        '--plan <plan>',
        'Template plan name from the dbaas plans output.'
      )
      .requiredOption(
        '--database-name <databaseName>',
        'Initial database name.'
      )
      .requiredOption(
        '--password <password>',
        'Initial admin password that matches the frontend DBaaS policy.'
      )
      .option(
        '--username <username>',
        'Initial admin username. Defaults to admin.',
        'admin'
      )
      .option('--no-public-ip', 'Create the DBaaS without a public endpoint.')
  ).action(async (options: DbaasCreateOptions, commandInstance: Command) => {
    const result = await service.createDbaas(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('reset-password <dbaasId>')
      .description('Reset the admin password for a supported DBaaS cluster.')
      .requiredOption(
        '--password <password>',
        'New admin password that matches the frontend DBaaS policy.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasResetPasswordOptions,
      commandInstance: Command
    ) => {
      const result = await service.resetPassword(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <dbaasId>')
      .description('Delete a supported DBaaS cluster.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteDbaas(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
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
