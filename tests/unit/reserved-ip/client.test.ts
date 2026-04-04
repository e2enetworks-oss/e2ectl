import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { ReservedIpApiClient } from '../../../src/reserved-ip/client.js';

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

describe('ReservedIpApiClient', () => {
  it('lists reserved IPs through the reserve_ips collection path', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
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

    const result = await client.listReservedIps();

    expect(transport.getMock).toHaveBeenCalledWith('/reserve_ips/', undefined);
    expect(result).toEqual([
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
    ]);
  });

  it('creates reserved IPs through the reserve_ips collection path', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope({
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

    const result = await client.createReservedIp();

    expect(transport.postMock).toHaveBeenCalledWith('/reserve_ips/', undefined);
    expect(result.ip_address).toBe('164.52.198.54');
  });

  it('creates reserved IPs from a node public network through the vm_id query', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope({
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
      })
    );

    const result = await client.createReservedIp({
      vm_id: '100157'
    });

    expect(transport.postMock).toHaveBeenCalledWith('/reserve_ips/', {
      query: {
        vm_id: '100157'
      }
    });
    expect(result.vm_id).toBe(100157);
  });

  it('attaches reserved IPs to nodes through the reserve_ips action path', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope(
        {
          IP: '164.52.198.54',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        },
        {
          message: 'IP assigned successfully.'
        }
      )
    );

    const result = await client.attachReservedIpToNode('164.52.198.54', {
      type: 'attach',
      vm_id: 100157
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/reserve_ips/164.52.198.54/actions/',
      {
        body: {
          type: 'attach',
          vm_id: 100157
        }
      }
    );
    expect(result).toEqual({
      ip_address: '164.52.198.54',
      message: 'IP assigned successfully.',
      status: 'Assigned',
      vm_id: 100157,
      vm_name: 'node-a'
    });
  });

  it('detaches reserved IPs from nodes through the reserve_ips action path', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope(
        {
          IP: '164.52.198.54',
          status: 'Reserved',
          vm_id: 100157,
          vm_name: 'node-a'
        },
        {
          message: 'IP detached successfully.'
        }
      )
    );

    const result = await client.detachReservedIpFromNode('164.52.198.54', {
      type: 'detach',
      vm_id: 100157
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/reserve_ips/164.52.198.54/actions/',
      {
        body: {
          type: 'detach',
          vm_id: 100157
        }
      }
    );
    expect(result).toEqual({
      ip_address: '164.52.198.54',
      message: 'IP detached successfully.',
      status: 'Reserved',
      vm_id: 100157,
      vm_name: 'node-a'
    });
  });

  it('deletes reserved IPs through the reserve_ips action path', async () => {
    const transport = new StubTransport();
    const client = new ReservedIpApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope(
        {
          message: 'IP Released 164.52.198.54'
        },
        {
          message: 'Success'
        }
      )
    );

    const result = await client.deleteReservedIp('164.52.198.54');

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/reserve_ips/164.52.198.54/actions/',
      undefined
    );
    expect(result).toEqual({
      message: 'IP Released 164.52.198.54'
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
