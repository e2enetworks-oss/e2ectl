import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient, NodeCreateRequest } from '../../../src/node/index.js';
import { NodeService } from '../../../src/node/service.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function toJsonOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createNodeClientStub() {
  const attachSshKeys = vi.fn(() =>
    Promise.resolve({
      action_type: 'Add SSH Keys',
      created_at: '2026-03-14T08:00:00Z',
      id: 801,
      resource_id: '101',
      status: 'Done'
    })
  );
  const createNode = vi.fn((body: NodeCreateRequest) =>
    Promise.resolve({
      node_create_response: [
        {
          created_at: '2026-03-11T10:00:00Z',
          id: 205,
          location: 'Delhi',
          name: body.name,
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.2',
          public_ip_address: '1.1.1.2',
          status: 'Creating'
        }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    })
  );
  const deleteNode = vi.fn(() =>
    Promise.resolve({
      message: 'Success'
    })
  );
  const getNode = vi.fn(() =>
    Promise.resolve({
      created_at: '2026-03-11T10:00:00Z',
      disk: '100 GB',
      id: 101,
      location: 'Delhi',
      memory: '8 GB',
      name: 'node-a',
      plan: 'C3.8GB',
      private_ip_address: '10.0.0.1',
      public_ip_address: '1.1.1.1',
      status: 'Running',
      vcpus: '4',
      vm_id: 100157
    })
  );
  const listNodeCatalogOs = vi.fn(() =>
    Promise.resolve({
      category_list: [
        {
          OS: 'Ubuntu',
          category: ['Linux Virtual Node'],
          version: [
            {
              number_of_domains: null,
              os: 'Ubuntu',
              software_version: '',
              sub_category: 'Ubuntu',
              version: '24.04'
            }
          ]
        }
      ]
    })
  );
  const listNodeCatalogPlans = vi.fn(() =>
    Promise.resolve([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        location: 'Delhi',
        name: 'C3.8GB',
        os: {
          category: 'Ubuntu',
          image: 'Ubuntu-24.04-Distro',
          name: 'Ubuntu',
          version: '24.04'
        },
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        specs: {
          committed_sku: [
            {
              committed_days: 90,
              committed_sku_id: 2711,
              committed_sku_name: '90 Days Committed , Rs. 6026.0',
              committed_sku_price: 6026
            }
          ],
          cpu: 4,
          disk_space: 100,
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'C3.8GB'
        }
      }
    ])
  );
  const listNodes = vi.fn(() =>
    Promise.resolve({
      nodes: [
        {
          id: 101,
          is_locked: false,
          name: 'node-a',
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.1',
          public_ip_address: '1.1.1.1',
          status: 'Running'
        }
      ],
      total_count: 1,
      total_page_number: 1
    })
  );
  const powerOffNode = vi.fn(() =>
    Promise.resolve({
      action_type: 'Power Off',
      created_at: '2026-03-14T08:15:00Z',
      id: 702,
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const powerOnNode = vi.fn(() =>
    Promise.resolve({
      action_type: 'Power On',
      created_at: '2026-03-14T08:10:00Z',
      id: 701,
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const saveNodeImage = vi.fn(() =>
    Promise.resolve({
      action_type: 'Save Image',
      created_at: '2026-03-14T08:20:00Z',
      id: 703,
      image_id: 'img-455',
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const upgradeNode = vi.fn(() =>
    Promise.resolve({
      location: 'Delhi',
      message: 'Node upgrade initiated',
      new_node_image_id: 8802,
      old_node_image_id: 8801,
      vm_id: 100157
    })
  );

  const stub: NodeClient = {
    attachSshKeys,
    createNode,
    deleteNode,
    getNode,
    listNodeCatalogOs,
    listNodeCatalogPlans,
    listNodes,
    powerOffNode,
    powerOnNode,
    saveNodeImage,
    upgradeNode
  };

  return {
    attachSshKeys,
    createNode,
    deleteNode,
    getNode,
    listNodeCatalogOs,
    listNodeCatalogPlans,
    listNodes,
    powerOffNode,
    powerOnNode,
    saveNodeImage,
    upgradeNode,
    stub
  };
}

function createSshKeyClientStub() {
  const createSshKey = vi.fn();
  const listSshKeys = vi.fn(() =>
    Promise.resolve([
      {
        label: 'admin',
        pk: 12,
        ssh_key: 'ssh-ed25519 AAAA admin@example.com',
        timestamp: '14-Mar-2026'
      },
      {
        label: 'deploy',
        pk: 13,
        ssh_key: 'ssh-ed25519 BBBB deploy@example.com',
        timestamp: '14-Mar-2026'
      }
    ])
  );

  const stub: SshKeyClient = {
    createSshKey,
    deleteSshKey: vi.fn(),
    listSshKeys
  };

  return {
    createSshKey,
    listSshKeys,
    stub
  };
}

function createSecurityGroupClientStub() {
  const attachNodeSecurityGroups = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group Attached Successfully'
    })
  );
  const detachNodeSecurityGroups = vi.fn(() =>
    Promise.resolve({
      message: 'Security Groups Detached Successfully'
    })
  );

  const stub: SecurityGroupClient = {
    attachNodeSecurityGroups,
    createSecurityGroup: vi.fn(),
    deleteSecurityGroup: vi.fn(),
    detachNodeSecurityGroups,
    getSecurityGroup: vi.fn(),
    listSecurityGroups: vi.fn(),
    updateSecurityGroup: vi.fn()
  };

  return {
    attachNodeSecurityGroups,
    detachNodeSecurityGroups,
    stub
  };
}

function createReservedIpClientStub() {
  const detachNodePublicIp = vi.fn(() =>
    Promise.resolve({
      ip_address: '1.1.1.1',
      message: 'Public IP detached successfully.',
      status: 'Reserved',
      vm_id: 100157,
      vm_name: 'node-a'
    })
  );

  const stub: ReservedIpClient = {
    attachReservedIpToNode: vi.fn(),
    createReservedIp: vi.fn(),
    deleteReservedIp: vi.fn(),
    detachNodePublicIp,
    detachReservedIpFromNode: vi.fn(),
    listReservedIps: vi.fn(),
    reserveNodePublicIp: vi.fn()
  };

  return {
    detachNodePublicIp,
    stub
  };
}

function createVolumeClientStub() {
  const attachVolumeToNode = vi.fn(() =>
    Promise.resolve({
      image_id: 8801,
      message: 'Block Storage is Attached to VM.',
      vm_id: 100157
    })
  );
  const createVolume = vi.fn();
  const detachVolumeFromNode = vi.fn(() =>
    Promise.resolve({
      image_id: 8801,
      message: 'Block Storage Detach Process is Started.',
      vm_id: 100157
    })
  );
  const listVolumePlans = vi.fn();
  const listVolumes = vi.fn();

  const stub: VolumeClient = {
    attachVolumeToNode,
    createVolume,
    deleteVolume: vi.fn(),
    detachVolumeFromNode,
    getVolume: vi.fn(),
    listVolumePlans,
    listVolumes
  };

  return {
    attachVolumeToNode,
    createVolume,
    detachVolumeFromNode,
    listVolumePlans,
    listVolumes,
    stub
  };
}

function createVpcClientStub() {
  const attachNodeVpc = vi.fn(() =>
    Promise.resolve({
      message: 'VPC attached successfully.',
      project_id: '12345',
      vpc_id: 23082,
      vpc_name: 'prod-vpc'
    })
  );
  const createVpc = vi.fn();
  const detachNodeVpc = vi.fn(() =>
    Promise.resolve({
      message: 'VPC detached successfully.',
      project_id: '12345',
      vpc_id: 23082,
      vpc_name: 'prod-vpc'
    })
  );
  const listVpcPlans = vi.fn();
  const listVpcs = vi.fn();

  const stub: VpcClient = {
    attachNodeVpc,
    createVpc,
    deleteVpc: vi.fn(),
    detachNodeVpc,
    getVpc: vi.fn(),
    listVpcPlans,
    listVpcs
  };

  return {
    attachNodeVpc,
    createVpc,
    detachNodeVpc,
    listVpcPlans,
    listVpcs,
    stub
  };
}

describe('node commands', () => {
  function createRuntimeFixture(options?: {
    confirmResult?: boolean;
    isInteractive?: boolean;
  }): {
    confirm: ReturnType<typeof vi.fn>;
    nodeStub: ReturnType<typeof createNodeClientStub>;
    prompt: ReturnType<typeof vi.fn>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    reservedIpStub: ReturnType<typeof createReservedIpClientStub>;
    runtime: CliRuntime;
    securityGroupStub: ReturnType<typeof createSecurityGroupClientStub>;
    sshKeyStub: ReturnType<typeof createSshKeyClientStub>;
    stdout: MemoryWriter;
    volumeStub: ReturnType<typeof createVolumeClientStub>;
    vpcStub: ReturnType<typeof createVpcClientStub>;
  } {
    const configPath = createTestConfigPath('node-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const nodeStub = createNodeClientStub();
    const reservedIpStub = createReservedIpClientStub();
    const securityGroupStub = createSecurityGroupClientStub();
    const sshKeyStub = createSshKeyClientStub();
    const volumeStub = createVolumeClientStub();
    const vpcStub = createVpcClientStub();
    const confirm = vi.fn(() =>
      Promise.resolve(options?.confirmResult ?? true)
    );
    const prompt = vi.fn(() => Promise.resolve(''));
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm,
      createNodeClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return nodeStub.stub;
      },
      createProjectClient: vi.fn(() => {
        throw new Error('Project client should not be created for this test.');
      }) as unknown as CliRuntime['createProjectClient'],
      createReservedIpClient: vi.fn(() => reservedIpStub.stub),
      createSecurityGroupClient: vi.fn(() => securityGroupStub.stub),
      createSshKeyClient: vi.fn(() => sshKeyStub.stub),
      createVolumeClient: vi.fn(() => volumeStub.stub),
      createVpcClient: vi.fn(() => vpcStub.stub),
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: options?.isInteractive ?? true,
      prompt,
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      confirm,
      nodeStub,
      prompt,
      receivedCredentials: () => credentials,
      reservedIpStub,
      runtime,
      securityGroupStub,
      sshKeyStub,
      stdout,
      volumeStub,
      vpcStub
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

  it('lists nodes in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      project_id: '12345',
      location: 'Delhi'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'list',
        nodes: [
          {
            id: 101,
            is_locked: false,
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running'
          }
        ],
        total_count: 1,
        total_page_number: 1
      })
    );
  });

  it('renders human node list output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID');
    expect(stdout.buffer).toContain('node-a');
    expect(stdout.buffer).toContain('1.1.1.1');
  });

  it('applies per-command project and location overrides', async () => {
    const { receivedCredentials, runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'list',
      '--alias',
      'prod',
      '--project-id',
      '46429',
      '--location',
      'Chennai'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      project_id: '46429',
      location: 'Chennai'
    });
  });

  it('gets a node in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'get',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 101');
    expect(stdout.buffer).toContain('Name: node-a');
    expect(stdout.buffer).toContain('Status: Running');
  });

  it('gets a node in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'get',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'get',
        node: {
          created_at: '2026-03-11T10:00:00Z',
          disk: '100 GB',
          id: 101,
          location: 'Delhi',
          memory: '8 GB',
          name: 'node-a',
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.1',
          public_ip_address: '1.1.1.1',
          status: 'Running',
          vcpus: '4',
          vm_id: 100157
        }
      })
    );
  });

  it('creates a public-node request that stays compatible with backend serializer defaults', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'create',
      '--name',
      'new-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--alias',
      'prod'
    ]);

    const request = nodeStub.createNode.mock.calls[0]?.[0];

    expect(request).toMatchObject({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'new-node',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(request).not.toHaveProperty('security_group_id');
    expect(request).not.toHaveProperty('vpc_id');
    expect(request).not.toHaveProperty('subnet_id');
    expect(request).not.toHaveProperty('reserve_ip');
    expect(request).not.toHaveProperty('reserve_ip_pool');
    expect(request).not.toHaveProperty('image_id');
    expect(request).not.toHaveProperty('disk');
    expect(request).not.toHaveProperty('is_encryption_required');
    expect(request).not.toHaveProperty('isEncryptionEnabled');
    expect(request).not.toHaveProperty('saved_image_template_id');
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'create',
        billing: {
          billing_type: 'hourly'
        },
        created: 1,
        nodes: [
          {
            created_at: '2026-03-11T10:00:00Z',
            id: 205,
            location: 'Delhi',
            name: 'new-node',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Creating'
          }
        ],
        requested: 1
      })
    );
  });

  it('renders human node create output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'create',
      '--name',
      'new-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Billing Type: hourly');
    expect(stdout.buffer).toContain('Requested: 1');
    expect(stdout.buffer).toContain('Created: 1');
    expect(stdout.buffer).toContain('new-node');
  });

  it('maps repeated --ssh-key-id flags into node create service options', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);
    const createNodeSpy = vi.spyOn(NodeService.prototype, 'createNode');

    try {
      await program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'create',
        '--name',
        'new-node',
        '--plan',
        'plan-123',
        '--image',
        'Ubuntu-24.04-Distro',
        '--ssh-key-id',
        '12',
        '--ssh-key-id',
        '13',
        '--ssh-key-id',
        '12',
        '--alias',
        'prod'
      ]);
    } finally {
      // Keep the real implementation active while still asserting the mapped options.
      expect(createNodeSpy).toHaveBeenCalledWith({
        alias: 'prod',
        billingType: 'hourly',
        image: 'Ubuntu-24.04-Distro',
        name: 'new-node',
        plan: 'plan-123',
        sshKeyIds: ['12', '13', '12']
      });
      createNodeSpy.mockRestore();
    }
  });

  it('maps --disk into node create service options', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);
    const createNodeSpy = vi.spyOn(NodeService.prototype, 'createNode');

    try {
      await program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'create',
        '--name',
        'new-node',
        '--plan',
        'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
        '--image',
        'Ubuntu-24.04-Distro',
        '--disk',
        '150',
        '--alias',
        'prod'
      ]);
    } finally {
      expect(createNodeSpy).toHaveBeenCalledWith({
        alias: 'prod',
        billingType: 'hourly',
        disk: '150',
        image: 'Ubuntu-24.04-Distro',
        name: 'new-node',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
        sshKeyIds: []
      });
      createNodeSpy.mockRestore();
    }
  });

  it('attaches security groups after resolving the node vm id', async () => {
    const { runtime, stdout, securityGroupStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'security-group',
      'attach',
      '101',
      '--security-group-id',
      '44',
      '--security-group-id',
      '45',
      '--security-group-id',
      '44',
      '--alias',
      'prod'
    ]);

    expect(securityGroupStub.attachNodeSecurityGroups).toHaveBeenCalledWith(
      100157,
      {
        security_group_ids: [44, 45]
      }
    );
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'security-group-attach',
        node_id: 101,
        result: {
          message: 'Security Group Attached Successfully'
        },
        security_group_ids: [44, 45]
      })
    );
  });

  it('detaches security groups in deterministic json mode', async () => {
    const { runtime, stdout, securityGroupStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'security-group',
      'detach',
      '101',
      '--security-group-id',
      '45',
      '--alias',
      'prod'
    ]);

    expect(securityGroupStub.detachNodeSecurityGroups).toHaveBeenCalledWith(
      100157,
      {
        security_group_ids: [45]
      }
    );
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'security-group-detach',
        node_id: 101,
        result: {
          message: 'Security Groups Detached Successfully'
        },
        security_group_ids: [45]
      })
    );
  });

  it('detaches the current public IP in deterministic json mode with context overrides', async () => {
    const {
      confirm,
      nodeStub,
      receivedCredentials,
      reservedIpStub,
      runtime,
      stdout
    } = createRuntimeFixture({
      isInteractive: true
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'public-ip',
      'detach',
      '101',
      '--alias',
      'prod',
      '--project-id',
      '46429',
      '--location',
      'Chennai'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Chennai',
      project_id: '46429'
    });
    expect(nodeStub.getNode).toHaveBeenCalledWith('101');
    expect(confirm).toHaveBeenCalledWith(
      'Detach public IP 1.1.1.1 from node 101? The node may no longer be publicly reachable.'
    );
    expect(reservedIpStub.detachNodePublicIp).toHaveBeenCalledWith({
      public_ip: '1.1.1.1',
      type: 'detach',
      vm_id: 100157
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'public-ip-detach',
        message: 'Public IP detached successfully.',
        node_id: 101,
        public_ip: '1.1.1.1'
      })
    );
  });

  it('maps committed create flags to cn_id and cn_status', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'create',
      '--name',
      'new-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--billing-type',
      'committed',
      '--committed-plan-id',
      '2711',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.createNode).toHaveBeenCalledWith({
      backups: false,
      cn_id: 2711,
      cn_status: 'auto_renew',
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'new-node',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'create',
        billing: {
          billing_type: 'committed',
          committed_plan_id: 2711,
          post_commit_behavior: 'auto_renew'
        },
        created: 1,
        nodes: [
          {
            created_at: '2026-03-11T10:00:00Z',
            id: 205,
            location: 'Delhi',
            name: 'new-node',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Creating'
          }
        ],
        requested: 1
      })
    );
  });

  it('rejects committed-only flags on hourly node creation', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'create',
        '--name',
        'new-node',
        '--plan',
        'plan-123',
        '--image',
        'Ubuntu-24.04-Distro',
        '--billing-type',
        'hourly',
        '--committed-plan-id',
        '2711',
        '--alias',
        'prod'
      ])
    ).rejects.toMatchObject({
      message:
        'Committed plan ID can only be used with --billing-type committed.'
    });
  });

  it('lists OS catalog rows in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'catalog',
      'os',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'catalog-os',
        entries: [
          {
            category: 'Ubuntu',
            display_category: 'Linux Virtual Node',
            number_of_domains: null,
            os: 'Ubuntu',
            os_version: '24.04',
            software_version: ''
          }
        ]
      })
    );
  });

  it('lists grouped plan and billing options for a selected catalog row', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'catalog',
      'plans',
      '--display-category',
      'Linux Virtual Node',
      '--category',
      'Ubuntu',
      '--os',
      'Ubuntu',
      '--os-version',
      '24.04',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.listNodeCatalogPlans).toHaveBeenCalledWith({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [
              {
                days: 90,
                id: 2711,
                name: '90 Days Committed , Rs. 6026.0',
                total_price: 6026
              }
            ],
            config: {
              disk_gb: 100,
              family: null,
              ram: '8.00',
              series: 'C3',
              vcpu: 4
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 3.1,
              price_per_month: 2263
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
            row: 1,
            sku: 'C3.8GB'
          }
        ],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      })
    );
  });

  it('passes through the requested billing filter for catalog plans', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'catalog',
      'plans',
      '--display-category',
      'Linux Virtual Node',
      '--category',
      'Ubuntu',
      '--os',
      'Ubuntu',
      '--os-version',
      '24.04',
      '--billing-type',
      'hourly',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Filters: OS=Ubuntu 24.04, Billing=hourly');
    expect(stdout.buffer).toContain('Candidate Configs');
    expect(stdout.buffer).toContain('Create hourly from config #1:');
    expect(stdout.buffer).not.toContain('Create committed from config #1:');
  });

  it('applies the optional family filter client-side for catalog plans', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'catalog',
      'plans',
      '--display-category',
      'Linux Virtual Node',
      '--category',
      'Ubuntu',
      '--os',
      'Ubuntu',
      '--os-version',
      '24.04',
      '--family',
      'General Purpose',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.listNodeCatalogPlans).toHaveBeenCalledWith({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          family: 'General Purpose',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      })
    );
  });

  it('requests power-on through the node action subtree', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'power-on',
      '101',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.powerOnNode).toHaveBeenCalledWith('101');
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'power-on',
        node_id: 101,
        result: {
          action_id: 701,
          created_at: '2026-03-14T08:10:00Z',
          image_id: null,
          status: 'In Progress'
        }
      })
    );
  });

  it('renders human power-on output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'action',
      'power-on',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Requested power on for node 101.');
    expect(stdout.buffer).toContain('Action ID: 701');
  });

  it('requests node upgrade through the top-level lifecycle command', async () => {
    const { confirm, nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'upgrade',
      '101',
      '--plan',
      'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro',
      '--alias',
      'prod'
    ]);

    expect(confirm).toHaveBeenCalledWith(
      'Upgrade node 101 to plan C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi with image Ubuntu-24.04-Distro? This is disruptive.'
    );
    expect(nodeStub.upgradeNode).toHaveBeenCalledWith('101', {
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'upgrade',
        details: {
          location: 'Delhi',
          new_node_image_id: 8802,
          old_node_image_id: 8801,
          vm_id: 100157
        },
        message: 'Node upgrade initiated',
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
        }
      })
    );
  });

  it('requests save-image with the provided name', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'save-image',
      '101',
      '--name',
      'node-a-image',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.saveNodeImage).toHaveBeenCalledWith('101', 'node-a-image');
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'save-image',
        image_name: 'node-a-image',
        node_id: 101,
        result: {
          action_id: 703,
          created_at: '2026-03-14T08:20:00Z',
          image_id: 'img-455',
          status: 'In Progress'
        }
      })
    );
  });

  it('renders human save-image output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'action',
      'save-image',
      '101',
      '--name',
      'node-a-image',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain(
      'Requested save image for node 101 as node-a-image.'
    );
    expect(stdout.buffer).toContain('Image ID: img-455');
  });

  it('routes VPC attach through the dedicated VPC client', async () => {
    const { runtime, stdout, vpcStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'vpc',
      'attach',
      '101',
      '--vpc-id',
      '23082',
      '--subnet-id',
      '991',
      '--private-ip',
      '10.0.0.25',
      '--alias',
      'prod'
    ]);

    expect(vpcStub.attachNodeVpc).toHaveBeenCalledWith({
      action: 'attach',
      input_ip: '10.0.0.25',
      network_id: 23082,
      node_id: 101,
      subnet_id: 991
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'vpc-attach',
        node_id: 101,
        result: {
          message: 'VPC attached successfully.',
          project_id: '12345'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: '10.0.0.25',
          subnet_id: 991
        }
      })
    );
  });

  it('renders human VPC attach output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'action',
      'vpc',
      'attach',
      '101',
      '--vpc-id',
      '23082',
      '--subnet-id',
      '991',
      '--private-ip',
      '10.0.0.25',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Requested VPC attach for node 101.');
    expect(stdout.buffer).toContain('VPC ID: 23082');
    expect(stdout.buffer).toContain('Private IP: 10.0.0.25');
  });

  it('resolves node vm ids before detaching volumes', async () => {
    const { nodeStub, runtime, stdout, volumeStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'volume',
      'detach',
      '101',
      '--volume-id',
      '8801',
      '--alias',
      'prod'
    ]);

    expect(nodeStub.getNode).toHaveBeenCalledWith('101');
    expect(volumeStub.detachVolumeFromNode).toHaveBeenCalledWith(8801, {
      vm_id: 100157
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'volume-detach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage Detach Process is Started.'
        },
        volume: {
          id: 8801
        }
      })
    );
  });

  it('renders human volume detach output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'action',
      'volume',
      'detach',
      '101',
      '--volume-id',
      '8801',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Requested volume detach for node 101.');
    expect(stdout.buffer).toContain('Volume ID: 8801');
    expect(stdout.buffer).toContain(
      'Message: Block Storage Detach Process is Started.'
    );
  });

  it('resolves saved ssh key ids before sending the node action request', async () => {
    const { nodeStub, runtime, sshKeyStub, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'ssh-key',
      'attach',
      '101',
      '--ssh-key-id',
      '12',
      '--ssh-key-id',
      '13',
      '--ssh-key-id',
      '12',
      '--alias',
      'prod'
    ]);

    expect(sshKeyStub.listSshKeys).toHaveBeenCalledTimes(1);
    expect(nodeStub.attachSshKeys).toHaveBeenCalledWith('101', [
      {
        label: 'admin',
        ssh_key: 'ssh-ed25519 AAAA admin@example.com'
      },
      {
        label: 'deploy',
        ssh_key: 'ssh-ed25519 BBBB deploy@example.com'
      }
    ]);
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'ssh-key-attach',
        node_id: 101,
        result: {
          action_id: 801,
          created_at: '2026-03-14T08:00:00Z',
          image_id: null,
          status: 'Done'
        },
        ssh_keys: [
          {
            id: 12,
            label: 'admin'
          },
          {
            id: 13,
            label: 'deploy'
          }
        ]
      })
    );
  });

  it('requires force outside an interactive terminal for public-ip detach after resolving node details', async () => {
    const { confirm, nodeStub, reservedIpStub, runtime } = createRuntimeFixture(
      {
        isInteractive: false
      }
    );
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'action',
        'public-ip',
        'detach',
        '101',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/requires confirmation/i);
    expect(nodeStub.getNode).toHaveBeenCalledWith('101');
    expect(confirm).not.toHaveBeenCalled();
    expect(reservedIpStub.detachNodePublicIp).not.toHaveBeenCalled();
  });

  it('skips confirmation for public-ip detach when --force is supplied', async () => {
    const { confirm, reservedIpStub, runtime, stdout } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'action',
      'public-ip',
      'detach',
      '101',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(reservedIpStub.detachNodePublicIp).toHaveBeenCalledWith({
      public_ip: '1.1.1.1',
      type: 'detach',
      vm_id: 100157
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'public-ip-detach',
        message: 'Public IP detached successfully.',
        node_id: 101,
        public_ip: '1.1.1.1'
      })
    );
  });

  it('renders human public-ip detach output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'node',
      'action',
      'public-ip',
      'detach',
      '101',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toContain('Requested public IP detach for node 101.');
    expect(stdout.buffer).toContain('Public IP: 1.1.1.1');
    expect(stdout.buffer).toContain(
      'Message: Public IP detached successfully.'
    );
    expect(stdout.buffer).toContain(
      'Warning: This node may no longer be publicly reachable.'
    );
  });

  it('cancels deletion when the confirmation is declined', async () => {
    const { confirm, nodeStub, runtime, stdout } = createRuntimeFixture({
      confirmResult: false,
      isInteractive: true
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod'
    ]);

    expect(confirm).toHaveBeenCalledWith(
      'Delete node 101? This cannot be undone.'
    );
    expect(nodeStub.deleteNode).not.toHaveBeenCalled();
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'delete',
        cancelled: true,
        node_id: 101,
        reserve_public_ip_requested: false
      })
    );
  });

  it('requires force outside an interactive terminal', async () => {
    const { nodeStub, runtime } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'delete',
        '101',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/requires confirmation/i);
    expect(nodeStub.deleteNode).not.toHaveBeenCalled();
  });

  it('deletes a node when force is supplied', async () => {
    const { confirm, nodeStub, runtime, stdout } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(nodeStub.deleteNode).toHaveBeenCalledWith('101', undefined);
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'delete',
        cancelled: false,
        message: 'Success',
        node_id: 101,
        reserve_public_ip_requested: false
      })
    );
  });

  it('deletes a node while requesting public IP reservation when --reserve-public-ip is supplied', async () => {
    const { confirm, nodeStub, runtime, stdout } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod',
      '--reserve-public-ip',
      '--force'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(nodeStub.deleteNode).toHaveBeenCalledWith('101', {
      reserve_ip_required: 'true'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'delete',
        cancelled: false,
        message: 'Success',
        node_id: 101,
        reserve_public_ip_requested: true
      })
    );
  });

  it('rejects non-numeric node identifiers', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'node',
        'get',
        'node-abc',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/Node ID must be numeric/i);
  });

  it('shows node help with the action and catalog namespaces', () => {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    const nodeCommand = program.commands.find(
      (command) => command.name() === 'node'
    );

    expect(nodeCommand).toBeDefined();
    expect(nodeCommand?.helpInformation()).toContain('action');
    expect(nodeCommand?.helpInformation()).toContain('catalog');
    expect(nodeCommand?.helpInformation()).toContain('create');
  });
});
