import { Command, CommanderError } from 'commander';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import type { LoadBalancerClient } from '../../../src/load-balancer/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createVolumeClientStub() {
  const createVolume = vi.fn(() =>
    Promise.resolve({
      id: 25550,
      image_name: 'data-01'
    })
  );
  const deleteVolume = vi.fn(() =>
    Promise.resolve({
      message: 'Block Storage Deleted'
    })
  );
  const getVolume = vi.fn(() =>
    Promise.resolve({
      block_id: 25550,
      is_block_storage_exporting_to_eos: false,
      name: 'data-01',
      size: 238419,
      size_string: '250 GB',
      snapshot_exist: false,
      status: 'Available',
      vm_detail: {}
    })
  );
  const listVolumePlans = vi.fn(() =>
    Promise.resolve([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days Committed , INR 1000',
            committed_sku_price: 1000
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ])
  );
  const listVolumes = vi.fn(() =>
    Promise.resolve({
      items: [
        {
          block_id: 25550,
          name: 'data-01',
          size: 238419,
          size_string: '250 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 1
    })
  );

  const stub: VolumeClient = {
    attachVolumeToNode: vi.fn(),
    createVolume,
    deleteVolume,
    detachVolumeFromNode: vi.fn(),
    getVolume,
    listVolumePlans,
    listVolumes
  };

  return {
    createVolume,
    deleteVolume,
    getVolume,
    listVolumePlans,
    listVolumes,
    stub
  };
}

describe('volume commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createVolumeClientStub>;
  } {
    const configPath = createTestConfigPath('volume-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createVolumeClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => NodeClient,
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
      }) as unknown as (credentials: ResolvedCredentials) => never,
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SshKeyClient,
      createVolumeClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      createLoadBalancerClient: vi.fn(() => {
        throw new Error(
          'Load balancer client should not be created for this test.'
        );
      }) as unknown as (credentials: ResolvedCredentials) => LoadBalancerClient,
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VpcClient,
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
    const restoreSpy = () => {
      stdoutSpy.mockRestore();
    };

    try {
      await program.parseAsync(['node', CLI_COMMAND_NAME, ...args]);
    } catch (error: unknown) {
      restoreSpy();

      if (
        !(error instanceof CommanderError) ||
        error.code !== 'commander.helpDisplayed'
      ) {
        throw error;
      }

      return chunks.join('');
    }

    restoreSpy();
    return chunks.join('');
  }

  function prepareProgramForHelp(program: Command): void {
    program.exitOverride();

    for (const childCommand of program.commands) {
      prepareProgramForHelp(childCommand);
    }
  }

  it('lists volumes in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'volume',
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
        items: [
          {
            attached: false,
            attachment: null,
            id: 25550,
            name: 'data-01',
            size_gb: 250,
            size_label: '250 GB',
            status: 'Available'
          }
        ],
        total_count: 1,
        total_page_number: 1
      })}\n`
    );
  });

  it('renders human volume list output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'volume',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID');
    expect(stdout.buffer).toContain('data-01');
    expect(stdout.buffer).toContain('250 GB');
  });

  it('renders volume plans in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'volume',
      'plans',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Showing 1 plan row.');
    expect(stdout.buffer).toContain('Committed Options For 250 GB');
    expect(stdout.buffer).toContain('Plan ID');
  });

  it('renders filtered volume plans in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'volume',
      'plans',
      '--alias',
      'prod',
      '--size',
      '250',
      '--available-only'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'plans',
        filters: {
          available_only: true,
          size_gb: 250
        },
        items: [
          {
            available: true,
            committed_options: [
              {
                id: 31,
                name: '30 Days Committed',
                savings_percent: 18.78,
                term_days: 30,
                total_price: 1000
              }
            ],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          }
        ],
        total_count: 1
      })}\n`
    );
  });

  it('gets one volume in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'volume',
      'get',
      '25550',
      '--alias',
      'prod'
    ]);

    expect(stub.getVolume).toHaveBeenCalledWith(25550);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'get',
        volume: {
          attached: false,
          attachment: null,
          exporting_to_eos: false,
          id: 25550,
          name: 'data-01',
          size_gb: 250,
          size_label: '250 GB',
          snapshot_exists: false,
          status: 'Available'
        }
      })}\n`
    );
  });

  it('renders human volume detail output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'volume',
      'get',
      '25550',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 25550');
    expect(stdout.buffer).toContain('Name: data-01');
    expect(stdout.buffer).toContain('Snapshot Exists: no');
  });

  it('deletes one volume in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'volume',
      'delete',
      '25550',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stub.deleteVolume).toHaveBeenCalledWith(25550);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: 'Block Storage Deleted',
        volume_id: 25550
      })}\n`
    );
  });

  it('renders human volume delete output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'volume',
      'delete',
      '25550',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toContain('Deleted volume 25550.');
    expect(stdout.buffer).toContain('Message: Block Storage Deleted');
  });

  it('creates volumes with committed billing in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'volume',
      'create',
      '--alias',
      'prod',
      '--name',
      'data-01',
      '--size',
      '250',
      '--billing-type',
      'committed',
      '--committed-plan-id',
      '31'
    ]);

    expect(stub.createVolume).toHaveBeenCalledWith({
      cn_id: 31,
      cn_status: 'auto_renew',
      iops: 5000,
      name: 'data-01',
      size: 250
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        billing: {
          committed_plan: {
            id: 31,
            name: '30 Days Committed',
            savings_percent: 18.78,
            term_days: 30,
            total_price: 1000
          },
          post_commit_behavior: 'auto-renew',
          type: 'committed'
        },
        requested: {
          name: 'data-01',
          size_gb: 250
        },
        resolved_plan: {
          available: true,
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        },
        volume: {
          id: 25550,
          name: 'data-01'
        }
      })}\n`
    );
  });

  it('renders human volume create output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'volume',
      'create',
      '--alias',
      'prod',
      '--name',
      'data-01',
      '--size',
      '250',
      '--billing-type',
      'committed',
      '--committed-plan-id',
      '31'
    ]);

    expect(stdout.buffer).toContain('Created volume: data-01');
    expect(stdout.buffer).toContain('Committed Plan: 31');
    expect(stdout.buffer).toContain('Next: run e2ectl volume list');
  });

  it('shows root help for volume commands', async () => {
    const help = await renderHelp(['volume']);

    expect(help).toContain('Manage MyAccount block storage volumes.');
    expect(help).toContain('Show help for a volume command');
  });

  it('shows help for volume create', async () => {
    const help = await renderHelp(['volume', 'create', '--help']);

    expect(help).toContain('Create a block storage volume.');
    expect(help).toContain('--committed-plan-id <committedPlanId>');
    expect(help).toContain('--post-commit-behavior <behavior>');
  });

  it('shows help for volume delete', async () => {
    const help = await renderHelp(['volume', 'delete', '--help']);

    expect(help).toContain('Delete a volume.');
    expect(help).toContain('--force');
  });
});
