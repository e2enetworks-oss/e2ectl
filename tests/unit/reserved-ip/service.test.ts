import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { ReservedIpService } from '../../../src/reserved-ip/service.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';

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

function sampleReservedIpSummary() {
  return {
    appliance_type: 'NODE',
    bought_at: '04-11-2024 10:37',
    floating_ip_attached_nodes: [
      {
        id: 101,
        ip_address_private: '10.0.0.5',
        ip_address_public: '164.52.198.55',
        name: 'node-a',
        security_group_status: 'Updated',
        status_name: 'Running',
        vm_id: 100157
      }
    ],
    ip_address: '164.52.198.54',
    project_name: 'default-project',
    reserve_id: 12662,
    reserved_type: 'AddonIP',
    status: 'Assigned',
    vm_id: 100157,
    vm_name: 'node-a'
  };
}

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  attachReservedIpToNode: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
  createReservedIp: ReturnType<typeof vi.fn>;
  createReservedIpClient: ReturnType<typeof vi.fn>;
  deleteReservedIp: ReturnType<typeof vi.fn>;
  detachReservedIpFromNode: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
  listReservedIps: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: ReservedIpService;
} {
  const attachReservedIpToNode = vi.fn();
  const createReservedIp = vi.fn();
  const deleteReservedIp = vi.fn();
  const detachReservedIpFromNode = vi.fn();
  const listReservedIps = vi.fn();
  const getNode = vi.fn();
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  let credentials: ResolvedCredentials | undefined;

  const reservedIpClient: ReservedIpClient = {
    attachReservedIpToNode,
    createReservedIp,
    deleteReservedIp,
    detachReservedIpFromNode,
    listReservedIps
  };
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
  const createReservedIpClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return reservedIpClient;
    }
  );
  const service = new ReservedIpService({
    confirm,
    createNodeClient: vi.fn(() => nodeClient),
    createReservedIpClient,
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    attachReservedIpToNode,
    confirm,
    createReservedIp,
    createReservedIpClient,
    deleteReservedIp,
    detachReservedIpFromNode,
    getNode,
    listReservedIps,
    receivedCredentials: () => credentials,
    service
  };
}

describe('ReservedIpService', () => {
  it('lists reserved IPs using resolved saved defaults and normalizes fields', async () => {
    const { listReservedIps, receivedCredentials, service } =
      createServiceFixture();

    listReservedIps.mockResolvedValue([sampleReservedIpSummary()]);

    const result = await service.listReservedIps({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          appliance_type: 'NODE',
          bought_at: '04-11-2024 10:37',
          floating_ip_attached_nodes: [
            {
              id: 101,
              ip_address_private: '10.0.0.5',
              ip_address_public: '164.52.198.55',
              name: 'node-a',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: 100157
            }
          ],
          ip_address: '164.52.198.54',
          project_name: 'default-project',
          reserve_id: 12662,
          reserved_type: 'AddonIP',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      ]
    });
  });

  it('gets one reserved IP by filtering the list and reuses the normalized item shape', async () => {
    const { listReservedIps, service } = createServiceFixture();

    listReservedIps.mockResolvedValue([sampleReservedIpSummary()]);

    const listResult = await service.listReservedIps({ alias: 'prod' });
    const getResult = await service.getReservedIp('164.52.198.54', {
      alias: 'prod'
    });

    expect(getResult).toEqual({
      action: 'get',
      reserved_ip: listResult.items[0]
    });
  });

  it('fails locally when get receives an invalid IPv4 address', async () => {
    const { createReservedIpClient, listReservedIps, service } =
      createServiceFixture();

    await expect(
      service.getReservedIp('not-an-ip', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_RESERVED_IP_ADDRESS',
      message: 'Reserved IP address must be a valid IPv4 address.'
    });
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(listReservedIps).not.toHaveBeenCalled();
  });

  it('fails locally when attach receives an invalid IPv4 address', async () => {
    const { createReservedIpClient, getNode, service } = createServiceFixture();

    await expect(
      service.attachReservedIpToNode('not-an-ip', {
        alias: 'prod',
        nodeId: '101'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_RESERVED_IP_ADDRESS',
      message: 'Reserved IP address must be a valid IPv4 address.'
    });
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(getNode).not.toHaveBeenCalled();
  });

  it('fails locally when detach receives an invalid IPv4 address', async () => {
    const { createReservedIpClient, getNode, service } = createServiceFixture();

    await expect(
      service.detachReservedIpFromNode('not-an-ip', {
        alias: 'prod',
        nodeId: '101'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_RESERVED_IP_ADDRESS',
      message: 'Reserved IP address must be a valid IPv4 address.'
    });
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(getNode).not.toHaveBeenCalled();
  });

  it('fails locally when delete receives an invalid IPv4 address', async () => {
    const { createReservedIpClient, deleteReservedIp, service } =
      createServiceFixture();

    await expect(
      service.deleteReservedIp('not-an-ip', {
        alias: 'prod',
        force: true
      })
    ).rejects.toMatchObject({
      code: 'INVALID_RESERVED_IP_ADDRESS',
      message: 'Reserved IP address must be a valid IPv4 address.'
    });
    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(deleteReservedIp).not.toHaveBeenCalled();
  });

  it('returns a clear not-found error when no reserved IP matches exactly', async () => {
    const { listReservedIps, service } = createServiceFixture();

    listReservedIps.mockResolvedValue([
      {
        ...sampleReservedIpSummary(),
        ip_address: '164.52.198.55'
      }
    ]);

    await expect(
      service.getReservedIp('164.52.198.54', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'RESERVED_IP_NOT_FOUND',
      message: 'Reserved IP 164.52.198.54 was not found.'
    });
  });

  it('creates reserved IPs and preserves the canonical ip_address in output', async () => {
    const { createReservedIp, getNode, service } = createServiceFixture();

    createReservedIp.mockResolvedValue({
      ...sampleReservedIpSummary(),
      status: 'Reserved',
      vm_id: null,
      vm_name: '--'
    });

    const result = await service.createReservedIp({ alias: 'prod' });

    expect(result).toEqual({
      action: 'create',
      reserved_ip: {
        appliance_type: 'NODE',
        bought_at: '04-11-2024 10:37',
        floating_ip_attached_nodes: [
          {
            id: 101,
            ip_address_private: '10.0.0.5',
            ip_address_public: '164.52.198.55',
            name: 'node-a',
            security_group_status: 'Updated',
            status_name: 'Running',
            vm_id: 100157
          }
        ],
        ip_address: '164.52.198.54',
        project_name: 'default-project',
        reserve_id: 12662,
        reserved_type: 'AddonIP',
        status: 'Reserved',
        vm_id: null,
        vm_name: '--'
      }
    });
    expect(createReservedIp).toHaveBeenCalledTimes(1);
    expect(getNode).not.toHaveBeenCalled();
  });

  it('creates reserved IPs from a node by resolving the backend vm_id internally', async () => {
    const { createReservedIp, getNode, service } = createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running',
      vm_id: 100157
    });
    createReservedIp.mockResolvedValue({
      ...sampleReservedIpSummary(),
      status: 'Assigned',
      vm_id: 100157,
      vm_name: 'node-a'
    });

    const result = await service.createReservedIp({
      alias: 'prod',
      fromNode: '101'
    });

    expect(getNode).toHaveBeenCalledWith('101');
    expect(createReservedIp).toHaveBeenCalledWith({
      vm_id: '100157'
    });
    expect(result).toEqual({
      action: 'create',
      reserved_ip: {
        appliance_type: 'NODE',
        bought_at: '04-11-2024 10:37',
        floating_ip_attached_nodes: [
          {
            id: 101,
            ip_address_private: '10.0.0.5',
            ip_address_public: '164.52.198.55',
            name: 'node-a',
            security_group_status: 'Updated',
            status_name: 'Running',
            vm_id: 100157
          }
        ],
        ip_address: '164.52.198.54',
        project_name: 'default-project',
        reserve_id: 12662,
        reserved_type: 'AddonIP',
        status: 'Assigned',
        vm_id: 100157,
        vm_name: 'node-a'
      }
    });
  });

  it('fails locally when create --from-node receives a non-numeric node id', async () => {
    const { createReservedIp, createReservedIpClient, getNode, service } =
      createServiceFixture();

    await expect(
      service.createReservedIp({
        alias: 'prod',
        fromNode: 'node-abc'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_NODE_ID',
      message: 'Node ID must be numeric.'
    });

    expect(createReservedIpClient).not.toHaveBeenCalled();
    expect(getNode).not.toHaveBeenCalled();
    expect(createReservedIp).not.toHaveBeenCalled();
  });

  it('fails clearly for create --from-node when node details do not include a vm_id', async () => {
    const { createReservedIp, getNode, service } = createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running'
    });

    await expect(
      service.createReservedIp({
        alias: 'prod',
        fromNode: '101'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_NODE_DETAILS',
      message: 'The MyAccount API did not return a VM ID for this node.'
    });

    expect(createReservedIp).not.toHaveBeenCalled();
  });

  it('attaches reserved IPs to nodes after resolving the backend vm_id from the CLI node id', async () => {
    const { attachReservedIpToNode, getNode, service } = createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running',
      vm_id: 100157
    });
    attachReservedIpToNode.mockResolvedValue({
      ip_address: '164.52.198.54',
      message: 'IP assigned successfully.',
      status: 'Assigned',
      vm_id: 100157,
      vm_name: 'node-a'
    });

    const result = await service.attachReservedIpToNode('164.52.198.54', {
      alias: 'prod',
      nodeId: '101'
    });

    expect(getNode).toHaveBeenCalledWith('101');
    expect(attachReservedIpToNode).toHaveBeenCalledWith('164.52.198.54', {
      type: 'attach',
      vm_id: 100157
    });
    expect(result).toEqual({
      action: 'attach-node',
      message: 'IP assigned successfully.',
      node_id: 101,
      reserved_ip: {
        ip_address: '164.52.198.54',
        status: 'Assigned',
        vm_id: 100157,
        vm_name: 'node-a'
      }
    });
  });

  it('detaches reserved IPs from nodes after resolving the backend vm_id from the CLI node id', async () => {
    const { detachReservedIpFromNode, getNode, service } =
      createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running',
      vm_id: 100157
    });
    detachReservedIpFromNode.mockResolvedValue({
      ip_address: '164.52.198.54',
      message: 'IP detached successfully.',
      status: 'Reserved',
      vm_id: 100157,
      vm_name: 'node-a'
    });

    const result = await service.detachReservedIpFromNode('164.52.198.54', {
      alias: 'prod',
      nodeId: '101'
    });

    expect(getNode).toHaveBeenCalledWith('101');
    expect(detachReservedIpFromNode).toHaveBeenCalledWith('164.52.198.54', {
      type: 'detach',
      vm_id: 100157
    });
    expect(result).toEqual({
      action: 'detach-node',
      message: 'IP detached successfully.',
      node_id: 101,
      reserved_ip: {
        ip_address: '164.52.198.54',
        status: 'Reserved',
        vm_id: 100157,
        vm_name: 'node-a'
      }
    });
  });

  it('fails clearly for attach when node details do not include a vm_id', async () => {
    const { attachReservedIpToNode, getNode, service } = createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running'
    });

    await expect(
      service.attachReservedIpToNode('164.52.198.54', {
        alias: 'prod',
        nodeId: '101'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_NODE_DETAILS',
      message: 'The MyAccount API did not return a VM ID for this node.'
    });
    expect(attachReservedIpToNode).not.toHaveBeenCalled();
  });

  it('fails clearly for detach when node details do not include a vm_id', async () => {
    const { detachReservedIpFromNode, getNode, service } =
      createServiceFixture();

    getNode.mockResolvedValue({
      id: 101,
      name: 'node-a',
      plan: 'C3.8GB',
      status: 'Running'
    });

    await expect(
      service.detachReservedIpFromNode('164.52.198.54', {
        alias: 'prod',
        nodeId: '101'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_NODE_DETAILS',
      message: 'The MyAccount API did not return a VM ID for this node.'
    });
    expect(detachReservedIpFromNode).not.toHaveBeenCalled();
  });

  it('returns a cancelled delete result when the confirmation prompt is declined', async () => {
    const { confirm, deleteReservedIp, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteReservedIp('164.52.198.54', {
      alias: 'prod'
    });

    expect(confirm).toHaveBeenCalledWith(
      'Delete reserved IP 164.52.198.54? This cannot be undone.'
    );
    expect(deleteReservedIp).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      ip_address: '164.52.198.54'
    });
  });

  it('fails in non-interactive mode when delete omits --force', async () => {
    const { deleteReservedIp, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteReservedIp('164.52.198.54', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a reserved IP requires confirmation in an interactive terminal.'
    });
    expect(deleteReservedIp).not.toHaveBeenCalled();
  });
});
