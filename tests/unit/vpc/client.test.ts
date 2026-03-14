import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { VpcApiClient } from '../../../src/vpc/client.js';
import type { VpcCreateRequest } from '../../../src/vpc/index.js';

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

describe('VpcApiClient', () => {
  it('attaches VPCs to nodes through the dedicated action path', async () => {
    const transport = new StubTransport();
    const client = new VpcApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope(
        {
          project_id: '46429',
          vpc_id: 23082,
          vpc_name: 'prod-vpc'
        },
        {
          message: 'VPC attached successfully.'
        }
      )
    );

    const result = await client.attachNodeVpc({
      action: 'attach',
      input_ip: '10.0.0.25',
      network_id: 23082,
      node_id: 101,
      subnet_id: 991
    });

    expect(transport.postMock).toHaveBeenCalledWith('/vpc/node/attach/', {
      body: {
        action: 'attach',
        input_ip: '10.0.0.25',
        network_id: 23082,
        node_id: 101,
        subnet_id: 991
      }
    });
    expect(result).toEqual({
      message: 'VPC attached successfully.',
      project_id: '46429',
      vpc_id: 23082,
      vpc_name: 'prod-vpc'
    });
  });

  it('creates VPCs through the VPC resource path', async () => {
    const transport = new StubTransport();
    const client = new VpcApiClient(transport);
    const request: VpcCreateRequest = {
      cn_id: 91,
      cn_status: 'hourly_billing',
      ipv4: '10.10.0.0/23',
      is_e2e_vpc: false,
      vpc_name: 'prod-vpc'
    };

    transport.postMock.mockResolvedValue(
      envelope({
        is_credit_sufficient: true,
        network_id: 27835,
        project_id: '46429',
        vpc_id: 3956,
        vpc_name: 'prod-vpc'
      })
    );

    const result = await client.createVpc(request);

    expect(transport.postMock).toHaveBeenCalledWith('/vpc/', {
      body: request
    });
    expect(result).toMatchObject({
      network_id: 27835,
      vpc_id: 3956
    });
  });

  it('reads VPC plans from the discovery path', async () => {
    const transport = new StubTransport();
    const client = new VpcApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          committed_sku: [],
          currency: 'INR',
          location: 'Delhi',
          name: 'VPC',
          price_per_hour: 4.79,
          price_per_month: 3500
        }
      ])
    );

    const result = await client.listVpcPlans();

    expect(transport.getMock).toHaveBeenCalledWith('/vpc/plans/', undefined);
    expect(result[0]?.name).toBe('VPC');
  });

  it('requests paginated VPC list data from the documented list path', async () => {
    const transport = new StubTransport();
    const client = new VpcApiClient(transport);

    transport.getMock.mockResolvedValue({
      ...envelope([
        {
          ipv4_cidr: '10.20.0.0/23',
          is_e2e_vpc: true,
          name: 'prod-vpc',
          network_id: 27835,
          state: 'Active'
        }
      ]),
      total_count: 1,
      total_page_number: 1
    });

    const result = await client.listVpcs(1, 100);

    expect(transport.getMock).toHaveBeenCalledWith('/vpc/list/', {
      query: {
        page_no: '1',
        per_page: '100'
      }
    });
    expect(result).toEqual({
      items: [
        {
          ipv4_cidr: '10.20.0.0/23',
          is_e2e_vpc: true,
          name: 'prod-vpc',
          network_id: 27835,
          state: 'Active'
        }
      ],
      total_count: 1,
      total_page_number: 1
    });
  });

  it('detaches VPCs from nodes through the dedicated action path', async () => {
    const transport = new StubTransport();
    const client = new VpcApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope(
        {
          project_id: '46429',
          vpc_id: 23082,
          vpc_name: 'prod-vpc'
        },
        {
          message: 'VPC detached successfully.'
        }
      )
    );

    await client.detachNodeVpc({
      action: 'detach',
      network_id: 23082,
      node_id: 101
    });

    expect(transport.postMock).toHaveBeenCalledWith('/vpc/node/detach/', {
      body: {
        action: 'detach',
        network_id: 23082,
        node_id: 101
      }
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
