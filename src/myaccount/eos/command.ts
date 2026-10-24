import { Command } from 'commander';

import { addContextOptions } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { renderEosResult } from './formatter.js';
import { EosService } from './service.js';
import type {
  EosAccessGrantOptions,
  EosCommandResult,
  EosContextOptions,
  EosForceOptions,
  EosKeyCreateOptions
} from './types.js';

interface GlobalOptions {
  json?: boolean;
}

type Writer = (result: EosCommandResult, commandInstance: Command) => void;

export function buildEosCommand(runtime: CliRuntime): Command {
  const service = new EosService({
    confirm: (message) => runtime.confirm(message),
    createEosClient: (credentials) => runtime.createEosClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const write: Writer = (result, commandInstance) => {
    runtime.stdout.write(
      renderEosResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  };
  const command = new Command('eos').description(
    'Manage EOS object storage: buckets, access keys, and which keys can use which bucket.'
  );

  command.helpCommand('help [command]', 'Show help for an eos command');
  command.addCommand(buildBucketCommand(service, write));
  command.addCommand(buildKeyCommand(service, write));
  command.addCommand(buildAccessCommand(service, write));
  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildBucketCommand(service: EosService, write: Writer): Command {
  const command = new Command('bucket').description(
    'Create, list and delete buckets.'
  );

  addContextOptions(
    command.command('list').description('List buckets.')
  ).action(async (options: EosContextOptions, instance: Command) => {
    write(await service.listBuckets(options), instance);
  });
  addContextOptions(
    command.command('create <name>').description('Create a bucket.')
  ).action(
    async (name: string, options: EosContextOptions, instance: Command) => {
      write(await service.createBucket(name, options), instance);
    }
  );
  addContextOptions(
    command
      .command('delete <name>')
      .description(
        'Delete a bucket and every object in it. E2E finishes this in the background.'
      )
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (name: string, options: EosForceOptions, instance: Command) => {
      write(await service.deleteBucket(name, options), instance);
    }
  );

  return withHelp(command);
}

function buildKeyCommand(service: EosService, write: Writer): Command {
  const command = new Command('key').description(
    'Create, list and delete access keys for S3 tools such as mc.'
  );

  addContextOptions(
    command
      .command('list')
      .description('List access keys (never their secrets).')
  ).action(async (options: EosContextOptions, instance: Command) => {
    write(await service.listKeys(options), instance);
  });
  addContextOptions(
    command
      .command('create')
      .description(
        'Create an access key. Prints the access key, the secret key (only here) and the endpoint.'
      )
      .requiredOption(
        '--name <name>',
        'A name to recognise the key by: 3 to 50 letters and digits.'
      )
  ).action(async (options: EosKeyCreateOptions, instance: Command) => {
    write(await service.createKey(options), instance);
  });
  addContextOptions(
    command
      .command('delete <accessKey>')
      .description('Delete an access key. Anything using it stops working.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (accessKey: string, options: EosForceOptions, instance: Command) => {
      write(await service.deleteKey(accessKey, options), instance);
    }
  );

  return withHelp(command);
}

function buildAccessCommand(service: EosService, write: Writer): Command {
  const command = new Command('access').description(
    'Control which access keys can use a bucket.'
  );

  addContextOptions(
    command
      .command('list <bucket>')
      .description('List the keys that can use a bucket.')
  ).action(
    async (bucket: string, options: EosContextOptions, instance: Command) => {
      write(await service.listAccess(bucket, options), instance);
    }
  );
  addContextOptions(
    command
      .command('grant <bucket>')
      .description(
        'Let an access key use a bucket. Other keys keep their access.'
      )
      .requiredOption(
        '--access-key <accessKey>',
        'Access key from eos key list.'
      )
      .requiredOption('--role <role>', 'admin, writer or reader.')
  ).action(
    async (
      bucket: string,
      options: EosAccessGrantOptions,
      instance: Command
    ) => {
      write(await service.grantAccess(bucket, options), instance);
    }
  );
  addContextOptions(
    command
      .command('revoke <bucket> <accessId>')
      .description(
        'Stop an access key using a bucket (the ID from eos access list).'
      )
  ).action(
    async (
      bucket: string,
      accessId: string,
      options: EosContextOptions,
      instance: Command
    ) => {
      write(await service.revokeAccess(bucket, accessId, options), instance);
    }
  );

  return withHelp(command);
}

function withHelp(command: Command): Command {
  command.helpCommand(
    'help [command]',
    `Show help for an eos ${command.name()} command`
  );
  command.action(() => {
    command.outputHelp();
  });
  return command;
}
