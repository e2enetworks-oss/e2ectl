import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { LoadBalancerApiClient } from '../../../src/load-balancer/client.js';
import type { LoadBalancerCreateRequest } from '../../../src/load-balancer/index.js';

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

function envelope<T>(data: T): ApiEnvelope<T> {
  return { code: 200, data, errors: {}, message: 'OK' };
}

describe('LoadBalancerApiClient', () => {
  it('lists load balancers via GET /appliances/load-balancers/', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          id: 1,
          appliance_name: 'my-alb',
          status: 'RUNNING',
          lb_mode: 'HTTP',
          lb_type: 'external',
          public_ip: '1.2.3.4'
        }
      ])
    );

    const result = await client.listLoadBalancers();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/appliances/load-balancers/',
      undefined
    );
    expect(result).toHaveLength(1);
    expect(result[0].appliance_name).toBe('my-alb');
  });

  it('creates a load balancer via POST /appliances/load-balancers/', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope({
        appliance_id: 42,
        id: 'lb-42',
        resource_type: 'load_balancer',
        label_id: 'label-1'
      })
    );

    const body: LoadBalancerCreateRequest = {
      lb_name: 'my-alb',
      lb_type: 'external',
      lb_mode: 'HTTP',
      lb_port: '80',
      plan_name: 'LB-2',
      node_list_type: 'S',
      backends: [],
      tcp_backend: [],
      acl_list: [],
      acl_map: [],
      client_timeout: 60,
      server_timeout: 60,
      connection_timeout: 60,
      http_keep_alive_timeout: 60
    };

    const result = await client.createLoadBalancer(body);

    expect(transport.postMock).toHaveBeenCalledWith(
      '/appliances/load-balancers/',
      { body }
    );
    expect(result.appliance_id).toBe(42);
  });

  it('gets a single load balancer via GET /appliances/load-balancers/<id>/', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        id: 99,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '5.6.7.8',
        context: [
          { backends: [], tcp_backend: [], lb_port: '80', plan_name: 'LB-2' }
        ]
      })
    );

    const result = await client.getLoadBalancer('99');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/appliances/load-balancers/99/',
      undefined
    );
    expect(result.appliance_name).toBe('my-nlb');
  });

  it('updates a load balancer via PUT /appliances/load-balancers/<id>/', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.requestMock.mockResolvedValue(envelope({}));

    const body: LoadBalancerCreateRequest = {
      lb_name: 'my-alb',
      lb_type: 'external',
      lb_mode: 'HTTP',
      lb_port: '80',
      plan_name: 'LB-2',
      node_list_type: 'S',
      backends: [],
      tcp_backend: [],
      acl_list: [],
      acl_map: [],
      client_timeout: 60,
      server_timeout: 60,
      connection_timeout: 60,
      http_keep_alive_timeout: 60
    };

    await client.updateLoadBalancer('99', body);

    expect(transport.requestMock).toHaveBeenCalledWith({
      body,
      method: 'PUT',
      path: '/appliances/load-balancers/99/'
    });
  });

  it('deletes a load balancer via DELETE /appliances/<id>/', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.deleteMock.mockResolvedValue(envelope({}));

    await client.deleteLoadBalancer('42');

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/appliances/42/',
      undefined
    );
  });

  it('deletes a load balancer with reserve_ip_required query param', async () => {
    const transport = new StubTransport();
    const client = new LoadBalancerApiClient(transport);

    transport.deleteMock.mockResolvedValue(envelope({}));

    await client.deleteLoadBalancer('42', { reserve_ip_required: 'true' });

    expect(transport.deleteMock).toHaveBeenCalledWith('/appliances/42/', {
      query: { reserve_ip_required: 'true' }
    });
  });
});
