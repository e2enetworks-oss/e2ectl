import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { NodeApiClient } from '../../../src/node/client.js';
import type { NodeCreateRequest } from '../../../src/node/index.js';

class StubTransport implements MyAccountTransport {
  readonly deleteMock = vi.fn();
  readonly getMock = vi.fn();
  readonly postMock = vi.fn();
  readonly requestMock = vi.fn();

  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
  }

  post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.postMock(path, options) as Promise<TResponse>;
  }

  request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse> {
    return this.requestMock(options) as Promise<TResponse>;
  }
}

describe('NodeApiClient', () => {
  it('powers on nodes through the node action path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.requestMock.mockResolvedValue(
      envelope({
        action_type: 'Power On',
        created_at: '2026-03-14T08:10:00Z',
        id: 701,
        resource_id: '101',
        status: 'In Progress'
      })
    );

    const result = await client.powerOnNode('101');

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: {
        type: 'power_on'
      },
      method: 'PUT',
      path: '/nodes/101/actions/'
    });
    expect(result.id).toBe(701);
  });

  it('powers off nodes through the node action path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.requestMock.mockResolvedValue(
      envelope({
        action_type: 'Power Off',
        created_at: '2026-03-14T08:15:00Z',
        id: 702,
        resource_id: '101',
        status: 'In Progress'
      })
    );

    await client.powerOffNode('101');

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: {
        type: 'power_off'
      },
      method: 'PUT',
      path: '/nodes/101/actions/'
    });
  });

  it('saves node images through the node action path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.requestMock.mockResolvedValue(
      envelope({
        action_type: 'Save Image',
        created_at: '2026-03-14T08:20:00Z',
        id: 703,
        image_id: 'img-455',
        resource_id: '101',
        status: 'In Progress'
      })
    );

    const result = await client.saveNodeImage('101', 'node-a-image');

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: {
        name: 'node-a-image',
        type: 'save_images'
      },
      method: 'PUT',
      path: '/nodes/101/actions/'
    });
    expect(result.image_id).toBe('img-455');
  });

  it('attaches saved ssh keys through the node action path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);
    const sshKeys = [
      {
        label: 'admin',
        ssh_key: 'ssh-ed25519 AAAA admin@example.com'
      }
    ];

    transport.requestMock.mockResolvedValue(
      envelope({
        action_type: 'Add SSH Keys',
        created_at: '2026-03-14T08:00:00Z',
        id: 704,
        resource_id: '101',
        status: 'Done'
      })
    );

    await client.attachSshKeys('101', sshKeys);

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: {
        ssh_keys: sshKeys,
        type: 'add_ssh_keys'
      },
      method: 'PUT',
      path: '/nodes/101/actions/'
    });
  });

  it('creates nodes through the node resource path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);
    const request: NodeCreateRequest = {
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    };

    transport.postMock.mockResolvedValue(
      envelope({
        node_create_response: [],
        total_number_of_node_created: 1,
        total_number_of_node_requested: 1
      })
    );

    const result = await client.createNode(request);

    expect(transport.postMock).toHaveBeenCalledWith('/nodes/', {
      body: request
    });
    expect(result.total_number_of_node_created).toBe(1);
  });

  it('preserves committed create fields in the posted node payload', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);
    const request: NodeCreateRequest = {
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
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    };

    transport.postMock.mockResolvedValue(
      envelope({
        node_create_response: [],
        total_number_of_node_created: 1,
        total_number_of_node_requested: 1
      })
    );

    await client.createNode(request);

    expect(transport.postMock).toHaveBeenCalledWith('/nodes/', {
      body: request
    });
  });

  it('reads the OS catalog from the discovery path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        category_list: []
      })
    );

    const result = await client.listNodeCatalogOs();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/images/os-category/',
      undefined
    );
    expect(result.category_list).toEqual([]);
  });

  it('requests plan and image pairs with the required query filters', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);
    const query = {
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    };

    transport.getMock.mockResolvedValue(envelope([]));

    await client.listNodeCatalogPlans(query);

    expect(transport.getMock).toHaveBeenCalledWith('/images/', {
      query
    });
  });

  it('unwraps node list metadata into the typed result shape', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.getMock.mockResolvedValue({
      ...envelope([
        {
          id: 101,
          name: 'node-a',
          plan: 'C3.8GB',
          status: 'Running'
        }
      ]),
      total_count: 1,
      total_page_number: 1
    });

    const result = await client.listNodes();

    expect(transport.getMock).toHaveBeenCalledWith('/nodes/', undefined);
    expect(result).toEqual({
      nodes: [
        {
          id: 101,
          name: 'node-a',
          plan: 'C3.8GB',
          status: 'Running'
        }
      ],
      total_count: 1,
      total_page_number: 1
    });
  });

  it('reads a single node from the node resource path', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        id: 101,
        name: 'node-a',
        plan: 'C3.8GB',
        status: 'Running'
      })
    );

    const result = await client.getNode('101');

    expect(transport.getMock).toHaveBeenCalledWith('/nodes/101/', undefined);
    expect(result.id).toBe(101);
  });

  it('returns the API success message for delete operations', async () => {
    const transport = new StubTransport();
    const client = new NodeApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope(
        {},
        {
          message: 'Deleted successfully'
        }
      )
    );

    const result = await client.deleteNode('101');

    expect(transport.deleteMock).toHaveBeenCalledWith('/nodes/101/', undefined);
    expect(result).toEqual({
      message: 'Deleted successfully'
    });
  });
});

function envelope<TData>(
  data: TData,
  overrides: Partial<ApiEnvelope<TData>> = {}
): ApiEnvelope<TData> {
  return {
    code: overrides.code ?? 200,
    data,
    errors: overrides.errors ?? {},
    message: overrides.message ?? 'Success'
  };
}
