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
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createVpcClientStub() {
  const createVpc = vi.fn(() =>
    Promise.resolve({
      is_credit_sufficient: true,
      network_id: 27835,
      project_id: '12345',
      vpc_id: 3956,
      vpc_name: 'prod-vpc'
    })
  );
  const deleteVpc = vi.fn(() =>
    Promise.resolve({
      message: 'Delete Vpc Initiated Successfully',
      result: {
        project_id: '12345',
        vpc_id: 27835,
        vpc_name: 'prod-vpc'
      }
    })
  );
  const getVpc = vi.fn(() =>
    Promise.resolve({
      created_at: '2026-03-13T08:00:00Z',
      ipv4_cidr: '10.20.0.0/23',
      is_e2e_vpc: true,
      name: 'prod-vpc',
      network_id: 27835,
      state: 'Active',
      subnets: [],
      vm_count: 2
    })
  );
  const listVpcPlans = vi.fn(() =>
    Promise.resolve([
      {
        committed_sku: [
          {
            committed_days: 90,
            committed_sku_id: 91,
            committed_sku_name: '90 Days',
            committed_sku_price: 7800
          }
        ],
        currency: 'INR',
        location: 'Delhi',
        name: 'VPC',
        price_per_hour: 4.79,
        price_per_month: 3500
      }
    ])
  );
  const listVpcs = vi.fn(() =>
    Promise.resolve({
      items: [
        {
          created_at: '2026-03-13T08:00:00Z',
          ipv4_cidr: '10.20.0.0/23',
          is_e2e_vpc: true,
          name: 'prod-vpc',
          network_id: 27835,
          state: 'Active',
          subnets: [],
          vm_count: 2
        }
      ],
      total_count: 1,
      total_page_number: 1
    })
  );

  const stub: VpcClient = {
    attachNodeVpc: vi.fn(),
    createVpc,
    deleteVpc,
    detachNodeVpc: vi.fn(),
    getVpc,
    listVpcPlans,
    listVpcs
  };

  return {
    createVpc,
    deleteVpc,
    getVpc,
    listVpcPlans,
    listVpcs,
    stub
  };
}

describe('vpc commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createVpcClientStub>;
  } {
    const configPath = createTestConfigPath('vpc-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createVpcClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createImageClient: vi.fn(() => {
        throw new Error('Image client should not be created for this test.');
      }) as unknown as CliRuntime['createImageClient'],
      createDbaasClient: vi.fn(() => {
        throw new Error('DBaaS client should not be created for this test.');
      }) as unknown as CliRuntime['createDbaasClient'],
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
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VolumeClient,
      createVpcClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
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

  it('lists VPCs in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'vpc',
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
            attached_vm_count: 2,
            cidr: '10.20.0.0/23',
            cidr_source: 'e2e',
            created_at: '2026-03-13T08:00:00Z',
            gateway_ip: null,
            id: 27835,
            location: null,
            name: 'prod-vpc',
            network_id: 27835,
            project_name: null,
            state: 'Active',
            subnet_count: 0,
            subnets: []
          }
        ],
        total_count: 1,
        total_page_number: 1
      })}\n`
    );
  });

  it('renders human VPC list output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'vpc',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('VPC ID');
    expect(stdout.buffer).toContain('prod-vpc');
    expect(stdout.buffer).toContain('10.20.0.0/23');
  });

  it('renders VPC plans in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'vpc',
      'plans',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Hourly');
    expect(stdout.buffer).toContain('Committed');
    expect(stdout.buffer).toContain('Plan ID');
  });

  it('creates VPCs with committed billing in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'vpc',
      'create',
      '--alias',
      'prod',
      '--name',
      'prod-vpc',
      '--billing-type',
      'committed',
      '--cidr-source',
      'custom',
      '--cidr',
      '10.10.0.0/23',
      '--committed-plan-id',
      '91'
    ]);

    expect(stub.createVpc).toHaveBeenCalledWith({
      cn_id: 91,
      cn_status: 'auto_renew',
      ipv4: '10.10.0.0/23',
      is_e2e_vpc: false,
      vpc_name: 'prod-vpc'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        billing: {
          committed_plan_id: 91,
          post_commit_behavior: 'auto-renew',
          type: 'committed'
        },
        cidr: {
          source: 'custom',
          value: '10.10.0.0/23'
        },
        credit_sufficient: true,
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          network_id: 27835,
          project_id: '12345',
          vpc_id: 3956
        }
      })}\n`
    );
  });

  it('renders human VPC create output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'vpc',
      'create',
      '--alias',
      'prod',
      '--name',
      'prod-vpc',
      '--billing-type',
      'committed',
      '--cidr-source',
      'custom',
      '--cidr',
      '10.10.0.0/23',
      '--committed-plan-id',
      '91'
    ]);

    expect(stdout.buffer).toContain('Created VPC request: prod-vpc');
    expect(stdout.buffer).toContain('VPC ID: 27835');
    expect(stdout.buffer).toContain('CIDR: custom 10.10.0.0/23');
    expect(stdout.buffer).toContain('Use VPC ID 27835');
  });

  it('gets one VPC in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'vpc',
      'get',
      '27835',
      '--alias',
      'prod'
    ]);

    expect(stub.getVpc).toHaveBeenCalledWith(27835);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'get',
        vpc: {
          attached_vm_count: 2,
          cidr: '10.20.0.0/23',
          cidr_source: 'e2e',
          created_at: '2026-03-13T08:00:00Z',
          gateway_ip: null,
          id: 27835,
          location: null,
          name: 'prod-vpc',
          network_id: 27835,
          project_name: null,
          state: 'Active',
          subnet_count: 0,
          subnets: []
        }
      })}\n`
    );
  });

  it('renders human VPC detail output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'vpc',
      'get',
      '27835',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('VPC ID: 27835');
    expect(stdout.buffer).toContain('Name: prod-vpc');
    expect(stdout.buffer).toContain('Source: E2E');
  });

  it('deletes one VPC in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'vpc',
      'delete',
      '27835',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stub.deleteVpc).toHaveBeenCalledWith(27835);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: 'Delete Vpc Initiated Successfully',
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          project_id: '12345'
        }
      })}\n`
    );
  });

  it('renders human VPC delete output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'vpc',
      'delete',
      '27835',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toContain('Deleted VPC 27835.');
    expect(stdout.buffer).toContain(
      'Message: Delete Vpc Initiated Successfully'
    );
  });

  it('shows root help for vpc commands', async () => {
    const help = await renderHelp(['vpc']);

    expect(help).toContain('Manage MyAccount VPC networks.');
    expect(help).toContain('Show help for a vpc command');
  });

  it('shows help for vpc create', async () => {
    const help = await renderHelp(['vpc', 'create', '--help']);

    expect(help).toContain('Create a VPC.');
    expect(help).toContain('--cidr-source <cidrSource>');
    expect(help).toContain('--committed-plan-id <committedPlanId>');
  });

  it('shows help for vpc delete', async () => {
    const help = await renderHelp(['vpc', 'delete', '--help']);

    expect(help).toContain('Delete a VPC by its canonical VPC ID');
    expect(help).toContain('--force');
  });
});
