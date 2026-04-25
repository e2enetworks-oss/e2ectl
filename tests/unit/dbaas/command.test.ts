import { Command, CommanderError } from 'commander';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { DbaasClient } from '../../../src/dbaas/index.js';
import type { ImageClient } from '../../../src/image/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createDbaasClientStub() {
  const createDbaas = vi.fn(() =>
    Promise.resolve({
      id: 7869,
      name: 'customer-db'
    })
  );
  const deleteDbaas = vi.fn(() =>
    Promise.resolve({
      cluster_id: 7869,
      name: 'customer-db'
    })
  );
  const getDbaas = vi.fn(() =>
    Promise.resolve({
      id: 7869,
      master_node: {
        cluster_id: 7869,
        database: {
          database: 'appdb',
          id: 11,
          pg_detail: {},
          username: 'admin'
        },
        domain: 'db.example.com',
        port: '3306',
        public_port: 3306
      },
      name: 'customer-db',
      software: {
        engine: 'Relational',
        id: 301,
        name: 'MySQL',
        version: '8.0'
      },
      status: 'Running'
    })
  );
  const listDbaas = vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: 7869,
          master_node: {
            cluster_id: 7869,
            database: {
              database: 'appdb',
              id: 11,
              pg_detail: {},
              username: 'admin'
            },
            domain: 'db.example.com',
            port: '3306',
            public_port: 3306
          },
          name: 'customer-db',
          software: {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          },
          status: 'Running'
        }
      ],
      total_count: 1,
      total_page_number: 1
    })
  );
  const listPlans = vi
    .fn()
    .mockResolvedValueOnce({
      database_engines: [
        {
          engine: 'Relational',
          id: 301,
          name: 'MySQL',
          version: '8.0'
        }
      ],
      template_plans: []
    })
    .mockResolvedValue({
      database_engines: [],
      template_plans: [
        {
          available_inventory_status: true,
          cpu: '2',
          currency: 'INR',
          disk: '100 GB',
          name: 'General Purpose Small',
          price_per_hour: 12,
          ram: '4',
          software: {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          },
          template_id: 901
        }
      ]
    });
  const resetPassword = vi.fn(() =>
    Promise.resolve({
      cluster_id: 7869,
      message: 'Password reset request processed successfully.',
      name: 'customer-db'
    })
  );

  const stub: DbaasClient = {
    createDbaas,
    deleteDbaas,
    getDbaas,
    listDbaas,
    listPlans,
    resetPassword
  };

  return {
    createDbaas,
    deleteDbaas,
    getDbaas,
    listDbaas,
    listPlans,
    resetPassword,
    stub
  };
}

describe('dbaas commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createDbaasClientStub>;
  } {
    const configPath = createTestConfigPath('dbaas-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createDbaasClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createImageClient: vi.fn(() => {
        throw new Error('Image client should not be created for this test.');
      }) as unknown as (_: ResolvedCredentials) => ImageClient,
      createDbaasClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as CliRuntime['createNodeClient'],
      createProjectClient: vi.fn(() => {
        throw new Error('Project client should not be created for this test.');
      }) as unknown as CliRuntime['createProjectClient'],
      createReservedIpClient: vi.fn(() => {
        throw new Error(
          'Reserved IP client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createReservedIpClient'],
      createSecurityGroupClient: vi.fn(() => {
        throw new Error(
          'Security group client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createSecurityGroupClient'],
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as CliRuntime['createSshKeyClient'],
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as CliRuntime['createVolumeClient'],
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as CliRuntime['createVpcClient'],
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: true,
      prompt: vi.fn(() => Promise.resolve('')),
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      receivedCredentials: () => credentials,
      runtime,
      stdout,
      stub
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
  }

  async function renderHelp(args: string[]): Promise<string> {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    prepareProgramForHelp(program);
    const chunks: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        chunks.push(String(chunk));
        return true;
      });

    try {
      await program.parseAsync(['node', CLI_COMMAND_NAME, ...args]);
    } catch (error: unknown) {
      stdoutSpy.mockRestore();

      if (
        !(error instanceof CommanderError) ||
        error.code !== 'commander.helpDisplayed'
      ) {
        throw error;
      }

      return chunks.join('');
    }

    stdoutSpy.mockRestore();
    return chunks.join('');
  }

  function prepareProgramForHelp(program: Command): void {
    program.exitOverride();

    for (const childCommand of program.commands) {
      prepareProgramForHelp(childCommand);
    }
  }

  it('lists DBaaS clusters in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dbaas',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '12345'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'list',
        filters: {
          type: null
        },
        items: [
          {
            connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            status: 'Running',
            type: 'MySQL',
            version: '8.0'
          }
        ],
        total_count: 1,
        total_page_number: 1
      })}\n`
    );
  });

  it('shows the plans subcommand in help output', async () => {
    const help = await renderHelp(['dbaas', '--help']);

    expect(help).toContain(
      'Manage MyAccount MariaDB, MySQL, and PostgreSQL DBaaS clusters.'
    );
    expect(help).toContain('plans');
    expect(help).toContain('reset-password');
  });

  it('shows safer DBaaS password file options in create help', async () => {
    const help = await renderHelp(['dbaas', 'create', '--help']);

    expect(help).toContain('--password <password>');
    expect(help).toContain('--password-file <path>');
    expect(help).toContain('or - to read from stdin');
  });

  it('creates DBaaS clusters through the command surface in json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dbaas',
      'create',
      '--alias',
      'prod',
      '--name',
      'customer-db',
      '--type',
      'sql',
      '--db-version',
      '8.0',
      '--plan',
      'General Purpose Small',
      '--database-name',
      'appdb',
      '--password',
      'ValidPassword1!A'
    ]);

    expect(stdout.buffer).toContain('"action": "create"');
    expect(stdout.buffer).toContain('"template_id": 901');
    expect(stdout.buffer).toContain('"type": "MySQL"');
  });

  it('resets passwords and deletes DBaaS clusters through the command surface', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'dbaas',
      'reset-password',
      '7869',
      '--alias',
      'prod',
      '--password',
      'ValidPassword1!A'
    ]);
    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dbaas',
      'delete',
      '7869',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toContain(
      'Password reset requested for DBaaS: customer-db'
    );
    expect(stdout.buffer).toContain('"action": "delete"');
    expect(stdout.buffer).toContain('"cancelled": false');
  });
});
