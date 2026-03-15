import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { NodeService } from '../../../src/node/service.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

function createServiceFixture(): {
  attachNodeVpc: ReturnType<typeof vi.fn>;
  attachSshKeys: ReturnType<typeof vi.fn>;
  attachVolumeToNode: ReturnType<typeof vi.fn>;
  createNode: ReturnType<typeof vi.fn>;
  createNodeClient: ReturnType<typeof vi.fn>;
  createSshKeyClient: ReturnType<typeof vi.fn>;
  createVolumeClient: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  detachNodeVpc: ReturnType<typeof vi.fn>;
  detachVolumeFromNode: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
  listNodeCatalogPlans: ReturnType<typeof vi.fn>;
  nodeClient: NodeClient;
  powerOffNode: ReturnType<typeof vi.fn>;
  powerOnNode: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  saveNodeImage: ReturnType<typeof vi.fn>;
  service: NodeService;
  listSshKeys: ReturnType<typeof vi.fn>;
  sshKeyClient: SshKeyClient;
  volumeClient: VolumeClient;
  vpcClient: VpcClient;
} {
  const attachSshKeys = vi.fn(() =>
    Promise.resolve({
      action_type: 'Add SSH Keys',
      created_at: '2026-03-14T08:00:00Z',
      id: 901,
      resource_id: '101',
      status: 'Done'
    })
  );
  const getNode = vi.fn(() =>
    Promise.resolve({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running',
      vm_id: 100157
    })
  );
  const powerOffNode = vi.fn(() =>
    Promise.resolve({
      action_type: 'Power Off',
      created_at: '2026-03-14T08:15:00Z',
      id: 902,
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const powerOnNode = vi.fn(() =>
    Promise.resolve({
      action_type: 'Power On',
      created_at: '2026-03-14T08:10:00Z',
      id: 903,
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const saveNodeImage = vi.fn(() =>
    Promise.resolve({
      action_type: 'Save Image',
      created_at: '2026-03-14T08:20:00Z',
      id: 904,
      image_id: 'img-455',
      resource_id: '101',
      status: 'In Progress'
    })
  );
  const createNode = vi.fn(() =>
    Promise.resolve({
      node_create_response: [],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    })
  );
  const listNodeCatalogPlans = vi.fn(() => Promise.resolve([]));
  const nodeClient: NodeClient = {
    attachSshKeys,
    createNode,
    deleteNode: vi.fn(),
    getNode,
    listNodeCatalogOs: vi.fn(),
    listNodeCatalogPlans,
    listNodes: vi.fn(),
    powerOffNode,
    powerOnNode,
    saveNodeImage
  };
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
  const sshKeyClient: SshKeyClient = {
    createSshKey: vi.fn(),
    listSshKeys
  };
  const attachVolumeToNode = vi.fn(() =>
    Promise.resolve({
      image_id: 8801,
      message: 'Block Storage is Attached to VM.',
      vm_id: 100157
    })
  );
  const detachVolumeFromNode = vi.fn(() =>
    Promise.resolve({
      image_id: 8801,
      message: 'Block Storage Detach Process is Started.',
      vm_id: 100157
    })
  );
  const volumeClient: VolumeClient = {
    attachVolumeToNode,
    createVolume: vi.fn(),
    detachVolumeFromNode,
    listVolumePlans: vi.fn(),
    listVolumes: vi.fn()
  };
  const attachNodeVpc = vi.fn(() =>
    Promise.resolve({
      message: 'VPC attached successfully.',
      project_id: '46429',
      vpc_id: 23082,
      vpc_name: 'prod-vpc'
    })
  );
  const detachNodeVpc = vi.fn(() =>
    Promise.resolve({
      message: 'VPC detached successfully.',
      project_id: '46429',
      vpc_id: 23082,
      vpc_name: 'prod-vpc'
    })
  );
  const vpcClient: VpcClient = {
    attachNodeVpc,
    createVpc: vi.fn(),
    detachNodeVpc,
    listVpcPlans: vi.fn(),
    listVpcs: vi.fn()
  };
  let credentials: ResolvedCredentials | undefined;

  const createNodeClient = vi.fn((resolvedCredentials: ResolvedCredentials) => {
    credentials = resolvedCredentials;
    return nodeClient;
  });
  const createSshKeyClient = vi.fn(() => sshKeyClient);
  const createVolumeClient = vi.fn(() => volumeClient);
  const createVpcClient = vi.fn(() => vpcClient);
  const service = new NodeService({
    confirm: vi.fn(() => Promise.resolve(true)),
    createNodeClient,
    createSshKeyClient,
    createVolumeClient,
    createVpcClient,
    isInteractive: true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    attachNodeVpc,
    attachSshKeys,
    attachVolumeToNode,
    createNode,
    createNodeClient,
    createSshKeyClient,
    createVolumeClient,
    createVpcClient,
    detachNodeVpc,
    detachVolumeFromNode,
    getNode,
    listNodeCatalogPlans,
    nodeClient,
    powerOffNode,
    powerOnNode,
    receivedCredentials: () => credentials,
    saveNodeImage,
    service,
    listSshKeys,
    sshKeyClient,
    volumeClient,
    vpcClient
  };
}

describe('NodeService', () => {
  it('maps power actions to clean command results using resolved defaults', async () => {
    const { powerOffNode, powerOnNode, receivedCredentials, service } =
      createServiceFixture();

    const powerOn = await service.powerOnNode('101', { alias: 'prod' });
    const powerOff = await service.powerOffNode('101', { alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(powerOnNode).toHaveBeenCalledWith('101');
    expect(powerOffNode).toHaveBeenCalledWith('101');
    expect(powerOn).toEqual({
      action: 'power-on',
      node_id: 101,
      result: {
        action_id: 903,
        created_at: '2026-03-14T08:10:00Z',
        image_id: null,
        status: 'In Progress'
      }
    });
    expect(powerOff).toEqual({
      action: 'power-off',
      node_id: 101,
      result: {
        action_id: 902,
        created_at: '2026-03-14T08:15:00Z',
        image_id: null,
        status: 'In Progress'
      }
    });
  });

  it('maps save-image to the backend action payload and result summary', async () => {
    const { saveNodeImage, service } = createServiceFixture();

    const result = await service.saveNodeImage('101', {
      alias: 'prod',
      name: 'node-a-image'
    });

    expect(saveNodeImage).toHaveBeenCalledWith('101', 'node-a-image');
    expect(result).toEqual({
      action: 'save-image',
      image_name: 'node-a-image',
      node_id: 101,
      result: {
        action_id: 904,
        created_at: '2026-03-14T08:20:00Z',
        image_id: 'img-455',
        status: 'In Progress'
      }
    });
  });

  it('routes VPC attach and detach through the VPC client with optional fields', async () => {
    const { attachNodeVpc, detachNodeVpc, service } = createServiceFixture();

    const attachResult = await service.attachVpc('101', {
      alias: 'prod',
      privateIp: '10.0.0.25',
      subnetId: '991',
      vpcId: '23082'
    });
    const detachResult = await service.detachVpc('101', {
      alias: 'prod',
      privateIp: '10.0.0.25',
      subnetId: '991',
      vpcId: '23082'
    });

    expect(attachNodeVpc).toHaveBeenCalledWith({
      action: 'attach',
      input_ip: '10.0.0.25',
      network_id: 23082,
      node_id: 101,
      subnet_id: 991
    });
    expect(detachNodeVpc).toHaveBeenCalledWith({
      action: 'detach',
      input_ip: '10.0.0.25',
      network_id: 23082,
      node_id: 101,
      subnet_id: 991
    });
    expect(attachResult.vpc).toEqual({
      id: 23082,
      name: 'prod-vpc',
      private_ip: '10.0.0.25',
      subnet_id: 991
    });
    expect(detachResult.result).toEqual({
      message: 'VPC detached successfully.',
      project_id: '46429'
    });
  });

  it('resolves node vm ids before volume attach and detach', async () => {
    const { attachVolumeToNode, detachVolumeFromNode, getNode, service } =
      createServiceFixture();

    const attachResult = await service.attachVolume('101', {
      alias: 'prod',
      volumeId: '8801'
    });
    const detachResult = await service.detachVolume('101', {
      alias: 'prod',
      volumeId: '8801'
    });

    expect(getNode).toHaveBeenNthCalledWith(1, '101');
    expect(getNode).toHaveBeenNthCalledWith(2, '101');
    expect(attachVolumeToNode).toHaveBeenCalledWith(8801, {
      vm_id: 100157
    });
    expect(detachVolumeFromNode).toHaveBeenCalledWith(8801, {
      vm_id: 100157
    });
    expect(attachResult).toEqual({
      action: 'volume-attach',
      node_id: 101,
      node_vm_id: 100157,
      result: {
        message: 'Block Storage is Attached to VM.'
      },
      volume: {
        id: 8801
      }
    });
    expect(detachResult.result).toEqual({
      message: 'Block Storage Detach Process is Started.'
    });
  });

  it('resolves ssh key ids, deduplicates repeats, and sends backend ssh key payloads', async () => {
    const { attachSshKeys, listSshKeys, service } = createServiceFixture();

    const result = await service.attachSshKeys('101', {
      alias: 'prod',
      sshKeyIds: ['12', '13', '12']
    });

    expect(listSshKeys).toHaveBeenCalledTimes(1);
    expect(attachSshKeys).toHaveBeenCalledWith('101', [
      {
        label: 'admin',
        ssh_key: 'ssh-ed25519 AAAA admin@example.com'
      },
      {
        label: 'deploy',
        ssh_key: 'ssh-ed25519 BBBB deploy@example.com'
      }
    ]);
    expect(result).toEqual({
      action: 'ssh-key-attach',
      node_id: 101,
      result: {
        action_id: 901,
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
    });
  });

  it('fails before sending the node action when an ssh key id does not resolve', async () => {
    const { attachSshKeys, service } = createServiceFixture();

    await expect(
      service.attachSshKeys('101', {
        alias: 'prod',
        sshKeyIds: ['12', '99']
      })
    ).rejects.toMatchObject({
      message: 'Unknown SSH key ID: 99.'
    });

    expect(attachSshKeys).not.toHaveBeenCalled();
  });

  it('maps committed create options to cn_id and auto_renew status', async () => {
    const { createNode, service } = createServiceFixture();

    const result = await service.createNode({
      alias: 'prod',
      billingType: 'committed',
      committedPlanId: '2711',
      image: 'Ubuntu-24.04-Distro',
      name: 'demo-node',
      plan: 'plan-123'
    });

    expect(createNode).toHaveBeenCalledWith({
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
      name: 'demo-node',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(result.billing).toEqual({
      billing_type: 'committed',
      committed_plan_id: 2711,
      post_commit_behavior: 'auto_renew'
    });
  });

  it('validates committed node create flags locally', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createNode({
        billingType: 'committed',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'plan-123'
      })
    ).rejects.toMatchObject({
      message:
        'Committed plan ID is required when --billing-type committed is used.'
    });

    await expect(
      service.createNode({
        billingType: 'hourly',
        committedPlanId: '2711',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'plan-123'
      })
    ).rejects.toMatchObject({
      message:
        'Committed plan ID can only be used with --billing-type committed.'
    });
  });

  it('groups catalog plans by config and keeps committed options nested', async () => {
    const { listNodeCatalogPlans, service } = createServiceFixture();

    listNodeCatalogPlans.mockResolvedValue([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'C3.8GB',
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
          family: 'CPU Intensive 3rd Generation',
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'C3.8GB'
        }
      },
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'C3.4GB',
        plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
        specs: {
          committed_sku: [],
          cpu: 2,
          disk_space: 50,
          family: 'CPU Intensive 3rd Generation',
          minimum_billing_amount: 0,
          price_per_hour: 1.8,
          price_per_month: 1321,
          ram: '4.00',
          series: 'C3',
          sku_name: 'C3.4GB'
        }
      }
    ]);

    const result = await service.listCatalogPlans({
      alias: 'prod',
      billingType: 'all',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      os: 'Ubuntu',
      osVersion: '24.04'
    });

    expect(listNodeCatalogPlans).toHaveBeenCalledWith({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(result).toEqual({
      action: 'catalog-plans',
      items: [
        {
          available_inventory: true,
          committed_options: [],
          config: {
            disk_gb: 50,
            family: 'CPU Intensive 3rd Generation',
            ram: '4.00',
            series: 'C3',
            vcpu: 2
          },
          currency: 'INR',
          hourly: {
            minimum_billing_amount: 0,
            price_per_hour: 1.8,
            price_per_month: 1321
          },
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
          row: 1,
          sku: 'C3.4GB'
        },
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
            family: 'CPU Intensive 3rd Generation',
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
          row: 2,
          sku: 'C3.8GB'
        }
      ],
      query: {
        billing_type: 'all',
        category: 'Ubuntu',
        display_category: 'Linux Virtual Node',
        os: 'Ubuntu',
        osversion: '24.04'
      },
      summary: {
        available_families: ['CPU Intensive 3rd Generation'],
        empty_reason: null
      }
    });
  });

  it('filters catalog plans for committed-only and hourly-only views', async () => {
    const { listNodeCatalogPlans, service } = createServiceFixture();

    listNodeCatalogPlans.mockResolvedValue([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'C3.8GB',
        plan: 'plan-1',
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
          price_per_hour: 3.1,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'C3.8GB'
        }
      },
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'C3.4GB',
        plan: 'plan-2',
        specs: {
          committed_sku: [],
          cpu: 2,
          disk_space: 50,
          price_per_hour: 1.8,
          price_per_month: 1321,
          ram: '4.00',
          series: 'C3',
          sku_name: 'C3.4GB'
        }
      }
    ]);

    const committedOnly = await service.listCatalogPlans({
      billingType: 'committed',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      os: 'Ubuntu',
      osVersion: '24.04'
    });
    const hourlyOnly = await service.listCatalogPlans({
      billingType: 'hourly',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      os: 'Ubuntu',
      osVersion: '24.04'
    });

    expect(committedOnly.items).toHaveLength(1);
    expect(committedOnly.items[0]?.committed_options).toHaveLength(1);
    expect(hourlyOnly.items).toHaveLength(2);
    expect(
      hourlyOnly.items.every((item) => item.committed_options.length === 0)
    ).toBe(true);
  });

  it('filters catalog plans by family client-side and reports empty family matches deterministically', async () => {
    const { listNodeCatalogPlans, service } = createServiceFixture();

    listNodeCatalogPlans.mockResolvedValue([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'gp-1',
        plan: 'plan-general',
        specs: {
          committed_sku: [],
          cpu: 2,
          disk_space: 50,
          family: 'General Purpose',
          price_per_hour: 1.8,
          price_per_month: 1321,
          ram: '4.00',
          series: 'C3',
          sku_name: 'gp-1'
        }
      },
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'ci-1',
        plan: 'plan-compute',
        specs: {
          committed_sku: [],
          cpu: 4,
          disk_space: 100,
          family: 'Compute Intensive',
          price_per_hour: 3.1,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'ci-1'
        }
      }
    ]);

    const matchingFamily = await service.listCatalogPlans({
      billingType: 'all',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      family: 'General Purpose',
      os: 'Ubuntu',
      osVersion: '24.04'
    });
    const missingFamily = await service.listCatalogPlans({
      billingType: 'all',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      family: 'Memory Optimized',
      os: 'Ubuntu',
      osVersion: '24.04'
    });

    expect(listNodeCatalogPlans).toHaveBeenNthCalledWith(1, {
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(listNodeCatalogPlans).toHaveBeenNthCalledWith(2, {
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(matchingFamily.items).toHaveLength(1);
    expect(matchingFamily.items[0]).toMatchObject({
      config: {
        family: 'General Purpose'
      },
      plan: 'plan-general'
    });
    expect(matchingFamily.query).toEqual({
      billing_type: 'all',
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      family: 'General Purpose',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(matchingFamily.summary).toEqual({
      available_families: ['Compute Intensive', 'General Purpose'],
      empty_reason: null
    });
    expect(missingFamily.items).toEqual([]);
    expect(missingFamily.query).toEqual({
      billing_type: 'all',
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      family: 'Memory Optimized',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(missingFamily.summary).toEqual({
      available_families: ['Compute Intensive', 'General Purpose'],
      empty_reason: 'no_family_match'
    });
  });

  it('distinguishes existing family matches with no committed options from true family misses', async () => {
    const { listNodeCatalogPlans, service } = createServiceFixture();

    listNodeCatalogPlans.mockResolvedValue([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        name: 'gp-hourly',
        plan: 'plan-general-hourly',
        specs: {
          committed_sku: [],
          cpu: 2,
          disk_space: 50,
          family: 'General Purpose',
          price_per_hour: 1.8,
          price_per_month: 1321,
          ram: '4.00',
          series: 'C3',
          sku_name: 'gp-hourly'
        }
      }
    ]);

    const result = await service.listCatalogPlans({
      billingType: 'committed',
      category: 'Ubuntu',
      displayCategory: 'Linux Virtual Node',
      family: 'General Purpose',
      os: 'Ubuntu',
      osVersion: '24.04'
    });

    expect(result.items).toEqual([]);
    expect(result.summary).toEqual({
      available_families: ['General Purpose'],
      empty_reason: 'no_committed_for_family'
    });
  });
});
