import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { NodeService } from '../../../src/node/service.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';
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

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  attachNodeVpc: ReturnType<typeof vi.fn>;
  attachNodeSecurityGroups: ReturnType<typeof vi.fn>;
  attachSshKeys: ReturnType<typeof vi.fn>;
  attachVolumeToNode: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
  createNode: ReturnType<typeof vi.fn>;
  createNodeClient: ReturnType<typeof vi.fn>;
  createReservedIpClient: ReturnType<typeof vi.fn>;
  createSecurityGroupClient: ReturnType<typeof vi.fn>;
  createSshKeyClient: ReturnType<typeof vi.fn>;
  createVolumeClient: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  deleteNode: ReturnType<typeof vi.fn>;
  detachNodePublicIp: ReturnType<typeof vi.fn>;
  detachNodeSecurityGroups: ReturnType<typeof vi.fn>;
  detachNodeVpc: ReturnType<typeof vi.fn>;
  detachVolumeFromNode: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
  listNodeCatalogPlans: ReturnType<typeof vi.fn>;
  nodeClient: NodeClient;
  powerOffNode: ReturnType<typeof vi.fn>;
  powerOnNode: ReturnType<typeof vi.fn>;
  readConfig: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  receivedSshKeyCredentials: () => ResolvedCredentials | undefined;
  saveNodeImage: ReturnType<typeof vi.fn>;
  service: NodeService;
  listSshKeys: ReturnType<typeof vi.fn>;
  sshKeyClient: SshKeyClient;
  upgradeNode: ReturnType<typeof vi.fn>;
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
      public_ip_address: '151.185.42.45',
      security_group_count: 2,
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
  const upgradeNode = vi.fn(() =>
    Promise.resolve({
      location: 'Delhi',
      message: 'Node upgrade initiated',
      new_node_image_id: 8802,
      old_node_image_id: 8801,
      vm_id: 100157
    })
  );
  const createNode = vi.fn(() =>
    Promise.resolve({
      node_create_response: [],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    })
  );
  const deleteNode = vi.fn(() =>
    Promise.resolve({
      message: 'Success'
    })
  );
  const listNodeCatalogPlans = vi.fn(() => Promise.resolve([]));
  const nodeClient: NodeClient = {
    attachSshKeys,
    createNode,
    deleteNode,
    getNode,
    listNodeCatalogOs: vi.fn(),
    listNodeCatalogPlans,
    listNodes: vi.fn(),
    powerOffNode,
    powerOnNode,
    saveNodeImage,
    upgradeNode
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
    deleteSshKey: vi.fn(),
    listSshKeys
  };
  const detachNodePublicIp = vi.fn(() =>
    Promise.resolve({
      ip_address: '151.185.42.45',
      message: 'Public IP detached successfully.',
      status: 'Reserved',
      vm_id: 100157,
      vm_name: 'node-a'
    })
  );
  const reservedIpClient: ReservedIpClient = {
    attachReservedIpToNode: vi.fn(),
    createReservedIp: vi.fn(),
    deleteReservedIp: vi.fn(),
    detachNodePublicIp,
    detachReservedIpFromNode: vi.fn(),
    listReservedIps: vi.fn(),
    reserveNodePublicIp: vi.fn()
  };
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
  const securityGroupClient: SecurityGroupClient = {
    attachNodeSecurityGroups,
    createSecurityGroup: vi.fn(),
    deleteSecurityGroup: vi.fn(),
    detachNodeSecurityGroups,
    getSecurityGroup: vi.fn(),
    listSecurityGroups: vi.fn(),
    updateSecurityGroup: vi.fn()
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
    deleteVolume: vi.fn(),
    detachVolumeFromNode,
    getVolume: vi.fn(),
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
    deleteVpc: vi.fn(),
    detachNodeVpc,
    getVpc: vi.fn(),
    listVpcPlans: vi.fn(),
    listVpcs: vi.fn()
  };
  let credentials: ResolvedCredentials | undefined;
  let sshKeyCredentials: ResolvedCredentials | undefined;

  const createNodeClient = vi.fn((resolvedCredentials: ResolvedCredentials) => {
    credentials = resolvedCredentials;
    return nodeClient;
  });
  const createSshKeyClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      sshKeyCredentials = resolvedCredentials;
      return sshKeyClient;
    }
  );
  const createReservedIpClient = vi.fn(() => reservedIpClient);
  const createVolumeClient = vi.fn(() => volumeClient);
  const createVpcClient = vi.fn(() => vpcClient);
  const createSecurityGroupClient = vi.fn(() => securityGroupClient);
  const readConfig = vi.fn(() => Promise.resolve(createConfig()));
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  const service = new NodeService({
    confirm,
    createNodeClient,
    createReservedIpClient,
    createSecurityGroupClient,
    createSshKeyClient,
    createVolumeClient,
    createVpcClient,
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: readConfig
    }
  });

  return {
    attachNodeVpc,
    attachNodeSecurityGroups,
    attachSshKeys,
    attachVolumeToNode,
    confirm,
    createNode,
    createNodeClient,
    createReservedIpClient,
    createSecurityGroupClient,
    createSshKeyClient,
    createVolumeClient,
    createVpcClient,
    deleteNode,
    detachNodePublicIp,
    detachNodeSecurityGroups,
    detachNodeVpc,
    detachVolumeFromNode,
    getNode,
    listNodeCatalogPlans,
    nodeClient,
    powerOffNode,
    powerOnNode,
    readConfig,
    receivedCredentials: () => credentials,
    receivedSshKeyCredentials: () => sshKeyCredentials,
    saveNodeImage,
    service,
    listSshKeys,
    sshKeyClient,
    upgradeNode,
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

  it('detaches the current node public IP after resolving node details first', async () => {
    const {
      confirm,
      createReservedIpClient,
      detachNodePublicIp,
      getNode,
      service
    } = createServiceFixture({
      isInteractive: true
    });

    const result = await service.detachPublicIp('101', { alias: 'prod' });

    expect(getNode).toHaveBeenCalledWith('101');
    expect(confirm).toHaveBeenCalledWith(
      'Detach public IP 151.185.42.45 from node 101? The node may no longer be publicly reachable.'
    );
    expect(createReservedIpClient).toHaveBeenCalledTimes(1);
    expect(detachNodePublicIp).toHaveBeenCalledWith({
      public_ip: '151.185.42.45',
      type: 'detach',
      vm_id: 100157
    });
    expect(result).toEqual({
      action: 'public-ip-detach',
      message: 'Public IP detached successfully.',
      node_id: 101,
      public_ip: '151.185.42.45'
    });
  });

  it('fails clearly when the node does not have a current public IP to detach', async () => {
    const { createReservedIpClient, detachNodePublicIp, getNode, service } =
      createServiceFixture();

    getNode.mockResolvedValueOnce({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      public_ip_address: null,
      status: 'Running',
      vm_id: 100157
    });

    await expect(
      service.detachPublicIp('101', {
        alias: 'prod',
        force: true
      })
    ).rejects.toThrow('This node does not have a current public IP to detach.');
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(detachNodePublicIp).not.toHaveBeenCalled();
  });

  it('fails clearly when node details do not include a vm_id for public IP detach', async () => {
    const { createReservedIpClient, detachNodePublicIp, getNode, service } =
      createServiceFixture();

    getNode.mockResolvedValueOnce({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      public_ip_address: '151.185.42.45',
      status: 'Running'
    });

    await expect(
      service.detachPublicIp('101', {
        alias: 'prod',
        force: true
      })
    ).rejects.toThrow(
      'The MyAccount API did not return a VM ID for this node.'
    );
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(detachNodePublicIp).not.toHaveBeenCalled();
  });

  it('requires force outside an interactive terminal for public IP detach after resolving node details', async () => {
    const { createReservedIpClient, detachNodePublicIp, getNode, service } =
      createServiceFixture({
        isInteractive: false
      });

    await expect(
      service.detachPublicIp('101', {
        alias: 'prod'
      })
    ).rejects.toThrow(
      'Detaching a node public IP requires confirmation in an interactive terminal.'
    );
    expect(getNode).toHaveBeenCalledWith('101');
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(detachNodePublicIp).not.toHaveBeenCalled();
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

  it('confirms disruptive node upgrades and preserves the backend message verbatim', async () => {
    const { confirm, service, upgradeNode } = createServiceFixture({
      isInteractive: true
    });

    const result = await service.upgradeNode('101', {
      alias: 'prod',
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
    });

    expect(confirm).toHaveBeenCalledWith(
      'Upgrade node 101 to plan C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi with image Ubuntu-24.04-Distro? This is disruptive.'
    );
    expect(upgradeNode).toHaveBeenCalledWith('101', {
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
    });
    expect(upgradeNode.mock.calls[0]?.[1]).not.toHaveProperty('vm_id');
    expect(upgradeNode.mock.calls[0]?.[1]).not.toHaveProperty('committed_id');
    expect(result).toEqual({
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
    });
  });

  it('returns a cancelled upgrade result before network when confirmation is declined', async () => {
    const { confirm, service, upgradeNode } = createServiceFixture({
      confirmResult: false,
      isInteractive: true
    });

    const result = await service.upgradeNode('101', {
      alias: 'prod',
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(upgradeNode).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'upgrade',
      cancelled: true,
      node_id: 101,
      requested: {
        image: 'Ubuntu-24.04-Distro',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
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

  it('resolves node vm ids before security-group attach and detach', async () => {
    const {
      attachNodeSecurityGroups,
      detachNodeSecurityGroups,
      getNode,
      service
    } = createServiceFixture();

    const attachResult = await service.attachSecurityGroups('101', {
      alias: 'prod',
      securityGroupIds: ['44', '45', '44']
    });
    const detachResult = await service.detachSecurityGroups('101', {
      alias: 'prod',
      securityGroupIds: ['45']
    });

    expect(getNode).toHaveBeenNthCalledWith(1, '101');
    expect(getNode).toHaveBeenNthCalledWith(2, '101');
    expect(attachNodeSecurityGroups).toHaveBeenCalledWith(100157, {
      security_group_ids: [44, 45]
    });
    expect(detachNodeSecurityGroups).toHaveBeenCalledWith(100157, {
      security_group_ids: [45]
    });
    expect(attachResult).toEqual({
      action: 'security-group-attach',
      node_id: 101,
      result: {
        message: 'Security Group Attached Successfully'
      },
      security_group_ids: [44, 45]
    });
    expect(detachResult).toEqual({
      action: 'security-group-detach',
      node_id: 101,
      result: {
        message: 'Security Groups Detached Successfully'
      },
      security_group_ids: [45]
    });
  });

  it('blocks detaching the last remaining security group before calling the backend', async () => {
    const { detachNodeSecurityGroups, getNode, service } =
      createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      security_group_count: 1,
      status: 'Running',
      vm_id: 100157
    });

    await expect(
      service.detachSecurityGroups('101', {
        alias: 'prod',
        securityGroupIds: ['45']
      })
    ).rejects.toMatchObject({
      code: 'LAST_SECURITY_GROUP_DETACH_BLOCKED',
      message: 'Node 101 must keep at least one attached security group.'
    });

    expect(getNode).toHaveBeenCalledWith('101');
    expect(detachNodeSecurityGroups).not.toHaveBeenCalled();
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

  it('resolves create ssh key ids once and sends raw ssh_keys in the create payload', async () => {
    const {
      createNode,
      createNodeClient,
      createSshKeyClient,
      listSshKeys,
      readConfig,
      receivedCredentials,
      receivedSshKeyCredentials,
      service
    } = createServiceFixture();

    await service.createNode({
      alias: 'prod',
      image: 'Ubuntu-24.04-Distro',
      name: 'demo-node',
      plan: 'plan-123',
      sshKeyIds: ['12', '13', '12']
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(createSshKeyClient).toHaveBeenCalledTimes(1);
    expect(createNodeClient).toHaveBeenCalledTimes(1);
    expect(receivedSshKeyCredentials()).toBe(receivedCredentials());
    expect(listSshKeys).toHaveBeenCalledTimes(1);
    expect(createNode).toHaveBeenCalledWith({
      backups: false,
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
      ssh_keys: [
        'ssh-ed25519 AAAA admin@example.com',
        'ssh-ed25519 BBBB deploy@example.com'
      ],
      start_scripts: []
    });
  });

  it('includes disk in the create payload when provided', async () => {
    const { createNode, service } = createServiceFixture();

    await service.createNode({
      alias: 'prod',
      disk: '150',
      image: 'Ubuntu-24.04-Distro',
      name: 'demo-node',
      plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi'
    });

    expect(createNode).toHaveBeenCalledWith({
      backups: false,
      default_public_ip: false,
      disk: 150,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'demo-node',
      number_of_instances: 1,
      plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
      ssh_keys: [],
      start_scripts: []
    });
  });

  it('requires disk for E1 and E1WC plans', async () => {
    const { createNode, createNodeClient, service } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi'
      })
    ).rejects.toMatchObject({
      message: 'Disk size is required for E1 and E1WC plans.'
    });

    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('rejects disk for non-E1 plans', async () => {
    const { createNode, createNodeClient, service } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        disk: '150',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
      })
    ).rejects.toMatchObject({
      message: 'Disk size can only be used with E1 or E1WC plans.'
    });

    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('fails before createNode when a requested create ssh key id does not resolve', async () => {
    const { createNode, createNodeClient, listSshKeys, service } =
      createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'plan-123',
        sshKeyIds: ['12', '99']
      })
    ).rejects.toMatchObject({
      message: 'Unknown SSH key ID: 99.'
    });

    expect(listSshKeys).toHaveBeenCalledTimes(1);
    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('validates create input before resolving context or ssh keys', async () => {
    const {
      createNode,
      createNodeClient,
      createSshKeyClient,
      listSshKeys,
      readConfig,
      service
    } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        image: '   ',
        name: 'demo-node',
        plan: 'plan-123',
        sshKeyIds: ['12']
      })
    ).rejects.toMatchObject({
      message: 'Image cannot be empty.'
    });

    expect(readConfig).not.toHaveBeenCalled();
    expect(createSshKeyClient).not.toHaveBeenCalled();
    expect(listSshKeys).not.toHaveBeenCalled();
    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('rejects invalid disk sizes before resolving context or ssh keys', async () => {
    const {
      createNode,
      createNodeClient,
      createSshKeyClient,
      listSshKeys,
      readConfig,
      service
    } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        disk: '0',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
        sshKeyIds: ['12']
      })
    ).rejects.toMatchObject({
      message: 'Disk size must be in the range 75 GB to 2400 GB.'
    });

    expect(readConfig).not.toHaveBeenCalled();
    expect(createSshKeyClient).not.toHaveBeenCalled();
    expect(listSshKeys).not.toHaveBeenCalled();
    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('rejects E1 disk sizes that do not match platform increments', async () => {
    const { createNode, createNodeClient, service } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        disk: '175',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi'
      })
    ).rejects.toMatchObject({
      message: 'Disk size at or above 150 GB must be a multiple of 50 GB.'
    });

    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
  });

  it('rejects E1 disk sizes below the default size that do not match downsize increments', async () => {
    const { createNode, createNodeClient, service } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        disk: '130',
        image: 'Ubuntu-24.04-Distro',
        name: 'demo-node',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi'
      })
    ).rejects.toMatchObject({
      message: 'Disk size below 150 GB must be a multiple of 25 GB.'
    });

    expect(createNodeClient).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
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

  it('omits reserve_ip_required when delete does not request public IP reservation', async () => {
    const { deleteNode, service } = createServiceFixture({
      isInteractive: false
    });

    const result = await service.deleteNode('101', {
      alias: 'prod',
      force: true
    });

    expect(deleteNode).toHaveBeenCalledWith('101', undefined);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Success',
      node_id: 101,
      reserve_public_ip_requested: false
    });
  });

  it('sends reserve_ip_required=true when delete requests public IP reservation', async () => {
    const { deleteNode, service } = createServiceFixture({
      isInteractive: false
    });

    const result = await service.deleteNode('101', {
      alias: 'prod',
      force: true,
      reservePublicIp: true
    });

    expect(deleteNode).toHaveBeenCalledWith('101', {
      reserve_ip_required: 'true'
    });
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Success',
      node_id: 101,
      reserve_public_ip_requested: true
    });
  });

  it('returns a cancelled delete result before network when confirmation is declined', async () => {
    const { deleteNode, service } = createServiceFixture({
      confirmResult: false,
      isInteractive: true
    });

    const result = await service.deleteNode('101', {
      alias: 'prod',
      reservePublicIp: true
    });

    expect(deleteNode).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      node_id: 101,
      reserve_public_ip_requested: true
    });
  });

  it('fails before network in non-interactive mode when delete omits --force', async () => {
    const { deleteNode, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteNode('101', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a node requires confirmation in an interactive terminal.'
    });

    expect(deleteNode).not.toHaveBeenCalled();
  });

  it('fails before network in non-interactive mode when upgrade omits --force', async () => {
    const { service, upgradeNode } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.upgradeNode('101', {
        alias: 'prod',
        image: 'Ubuntu-24.04-Distro',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
      })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Upgrading a node requires confirmation in an interactive terminal.'
    });

    expect(upgradeNode).not.toHaveBeenCalled();
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

  it('creates a saved-image node request with is_saved_image true', async () => {
    const { createNode, service } = createServiceFixture();

    await service.createNode({
      alias: 'prod',
      image: 'Ubuntu-24.04-Distro',
      name: 'image-node',
      plan: 'plan-123',
      savedImageTemplateId: '1448'
    });

    expect(createNode).toHaveBeenCalledWith({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: true,
      label: 'default',
      name: 'image-node',
      number_of_instances: 1,
      plan: 'plan-123',
      saved_image_template_id: 1448,
      ssh_keys: [],
      start_scripts: []
    });
  });

  it('requires --image for node create', async () => {
    const { createNodeClient, service } = createServiceFixture();

    await expect(
      service.createNode({
        alias: 'prod',
        name: 'demo-node',
        plan: 'plan-123'
      })
    ).rejects.toMatchObject({
      message: '--image is required for node create.'
    });

    expect(createNodeClient).not.toHaveBeenCalled();
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
