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

  delete<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  get<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
  }

  post<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.postMock(path, options) as Promise<TResponse>;
  }

  request<TResponse extends ApiEnvelope<unknown>>(
    options: ApiRequestOptions
  ): Promise<TResponse> {
    return this.requestMock(options) as Promise<TResponse>;
  }
}

describe('NodeApiClient', () => {
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
