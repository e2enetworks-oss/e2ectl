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
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createVolumeClientStub() {
  const createVolume = vi.fn(() =>
    Promise.resolve({
      id: 25550,
      image_name: 'data-01'
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
    detachVolumeFromNode: vi.fn(),
    listVolumePlans,
    listVolumes
  };

  return {
    createVolume,
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
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SshKeyClient,
      createVolumeClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
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
});
