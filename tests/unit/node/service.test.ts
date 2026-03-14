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
  createNodeClient: ReturnType<typeof vi.fn>;
  createSshKeyClient: ReturnType<typeof vi.fn>;
  createVolumeClient: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  detachNodeVpc: ReturnType<typeof vi.fn>;
  detachVolumeFromNode: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
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
  const nodeClient: NodeClient = {
    attachSshKeys,
    createNode: vi.fn(),
    deleteNode: vi.fn(),
    getNode,
    listNodeCatalogOs: vi.fn(),
    listNodeCatalogPlans: vi.fn(),
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
    createNodeClient,
    createSshKeyClient,
    createVolumeClient,
    createVpcClient,
    detachNodeVpc,
    detachVolumeFromNode,
    getNode,
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
});
