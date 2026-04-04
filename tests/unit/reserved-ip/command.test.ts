import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createReservedIpClientStub() {
  const attachReservedIpToNode = vi.fn(() =>
    Promise.resolve({
      ip_address: '164.52.198.54',
      message: 'IP assigned successfully.',
      status: 'Assigned',
      vm_id: 100157,
      vm_name: 'node-a'
    })
  );
  const createReservedIp = vi.fn<ReservedIpClient['createReservedIp']>(() =>
    Promise.resolve({
      appliance_type: 'NODE',
      bought_at: '04-11-2024 10:37',
      floating_ip_attached_nodes: [],
      ip_address: '164.52.198.54',
      project_name: 'default-project',
      reserve_id: 12662,
      reserved_type: 'AddonIP',
      status: 'Reserved',
      vm_id: null,
      vm_name: '--'
    })
  );
  const listReservedIps = vi.fn(() =>
    Promise.resolve([
      {
        appliance_type: 'NODE',
        bought_at: '04-11-2024 10:37',
        floating_ip_attached_nodes: [],
        ip_address: '164.52.198.54',
        project_name: 'default-project',
        reserve_id: 12662,
        reserved_type: 'AddonIP',
        status: 'Assigned',
        vm_id: 100157,
        vm_name: 'node-a'
      }
    ])
  );

  const stub: ReservedIpClient = {
    attachReservedIpToNode,
    createReservedIp,
    deleteReservedIp: vi.fn(() =>
      Promise.resolve({
        message: 'IP Released 164.52.198.54'
      })
    ),
    detachReservedIpFromNode: vi.fn(() =>
      Promise.resolve({
        ip_address: '164.52.198.54',
        message: 'IP detached successfully.',
        status: 'Reserved',
        vm_id: 100157,
        vm_name: 'node-a'
      })
    ),
    listReservedIps
  };

  return {
    attachReservedIpToNode,
    createReservedIp,
    listReservedIps,
    stub
  };
}

describe('reserved-ip commands', () => {
  function createRuntimeFixture(): {
    getNode: ReturnType<typeof vi.fn>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    reservedIpStub: ReturnType<typeof createReservedIpClientStub>;
    runtime: CliRuntime;
    stdout: MemoryWriter;
  } {
    const configPath = createTestConfigPath('reserved-ip-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const reservedIpStub = createReservedIpClientStub();
    let credentials: ResolvedCredentials | undefined;
    const getNode = vi.fn(() =>
      Promise.resolve({
        id: 101,
        name: 'node-a',
        plan: 'C3.8GB',
        status: 'Running',
        vm_id: 100157
      })
    );

    const nodeClient: NodeClient = {
      attachSshKeys: vi.fn(),
      createNode: vi.fn(),
      deleteNode: vi.fn(),
      getNode,
      listNodeCatalogOs: vi.fn(),
      listNodeCatalogPlans: vi.fn(),
      listNodes: vi.fn(),
      powerOffNode: vi.fn(),
      powerOnNode: vi.fn(),
      saveNodeImage: vi.fn(),
      upgradeNode: vi.fn()
    };

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createNodeClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return nodeClient;
      },
      createReservedIpClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return reservedIpStub.stub;
      },
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
      getNode,
      receivedCredentials: () => credentials,
      reservedIpStub,
      runtime,
      stdout
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

  it('lists reserved IPs in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'reserved-ip',
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
            appliance_type: 'NODE',
            bought_at: '04-11-2024 10:37',
            floating_ip_attached_nodes: [],
            ip_address: '164.52.198.54',
            project_name: 'default-project',
            reserve_id: 12662,
            reserved_type: 'AddonIP',
            status: 'Assigned',
            vm_id: 100157,
            vm_name: 'node-a'
          }
        ]
      })}\n`
    );
  });

  it('creates reserved IPs in deterministic json mode', async () => {
    const { reservedIpStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'reserved-ip',
      'create',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        reserved_ip: {
          appliance_type: 'NODE',
          bought_at: '04-11-2024 10:37',
          floating_ip_attached_nodes: [],
          ip_address: '164.52.198.54',
          project_name: 'default-project',
          reserve_id: 12662,
          reserved_type: 'AddonIP',
          status: 'Reserved',
          vm_id: null,
          vm_name: '--'
        }
      })}\n`
    );
    expect(reservedIpStub.createReservedIp).toHaveBeenCalledTimes(1);
  });

  it('creates reserved IPs from a node by wiring --from-node to the internal vm_id lookup', async () => {
    const { getNode, reservedIpStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    reservedIpStub.createReservedIp.mockResolvedValueOnce({
      appliance_type: 'NODE',
      bought_at: '04-11-2024 10:37',
      floating_ip_attached_nodes: [],
      ip_address: '164.52.198.54',
      project_name: 'default-project',
      reserve_id: 12662,
      reserved_type: 'AddonIP',
      status: 'Assigned',
      vm_id: 100157,
      vm_name: 'node-a'
    } as Awaited<ReturnType<ReservedIpClient['createReservedIp']>>);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'reserved-ip',
      'create',
      '--from-node',
      '101',
      '--alias',
      'prod'
    ]);

    expect(getNode).toHaveBeenCalledWith('101');
    expect(reservedIpStub.createReservedIp).toHaveBeenCalledWith({
      vm_id: '100157'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        reserved_ip: {
          appliance_type: 'NODE',
          bought_at: '04-11-2024 10:37',
          floating_ip_attached_nodes: [],
          ip_address: '164.52.198.54',
          project_name: 'default-project',
          reserve_id: 12662,
          reserved_type: 'AddonIP',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      })}\n`
    );
  });

  it('attaches reserved IPs to nodes through the targeted command shape', async () => {
    const { reservedIpStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'reserved-ip',
      'attach',
      'node',
      '164.52.198.54',
      '--node-id',
      '101',
      '--alias',
      'prod'
    ]);

    expect(reservedIpStub.attachReservedIpToNode).toHaveBeenCalledWith(
      '164.52.198.54',
      {
        type: 'attach',
        vm_id: 100157
      }
    );
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'attach-node',
        message: 'IP assigned successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      })}\n`
    );
  });
});
