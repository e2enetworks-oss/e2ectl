import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { DbaasApiClient } from '../../../src/dbaas/client.js';
import type {
  DbaasCreateRequest,
  DbaasResetPasswordRequest
} from '../../../src/dbaas/index.js';

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

describe('DbaasApiClient', () => {
  it('lists DBaaS clusters through the cluster collection path', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);

    transport.getMock.mockResolvedValue({
      ...envelope([
        {
          id: 7869,
          master_node: {
            cluster_id: 7869,
            database: {
              database: 'appdb',
              id: 11,
              pg_detail: {},
              username: 'admin'
            }
          },
          name: 'customer-db',
          software: {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        }
      ]),
      total_count: 1,
      total_page_number: 1
    });

    const result = await client.listDbaas(1, 100, {
      softwareType: 'MySQL'
    });

    expect(transport.getMock).toHaveBeenCalledWith('/rds/cluster/', {
      query: {
        page_no: '1',
        per_page: '100',
        software_type: 'MySQL'
      }
    });
    expect(result).toEqual({
      items: [
        {
          id: 7869,
          master_node: {
            cluster_id: 7869,
            database: {
              database: 'appdb',
              id: 11,
              pg_detail: {},
              username: 'admin'
            }
          },
          name: 'customer-db',
          software: {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        }
      ],
      total_count: 1,
      total_page_number: 1
    });
  });

  it('lists DBaaS plans with an optional software id filter', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        database_engines: [],
        template_plans: []
      })
    );

    await client.listPlans(301);

    expect(transport.getMock).toHaveBeenCalledWith('/rds/plans/', {
      query: {
        software_id: '301'
      }
    });
  });

  it('creates DBaaS clusters through the cluster collection path', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);
    const request: DbaasCreateRequest = {
      database: {
        dbaas_number: 1,
        name: 'appdb',
        password: 'Password1!',
        user: 'admin'
      },
      name: 'customer-db',
      public_ip_required: true,
      software_id: 301,
      template_id: 901
    };

    transport.postMock.mockResolvedValue(
      envelope({
        id: 7869,
        name: 'customer-db'
      })
    );

    const result = await client.createDbaas(request);

    expect(transport.postMock).toHaveBeenCalledWith('/rds/cluster/', {
      body: request
    });
    expect(result).toEqual({
      id: 7869,
      name: 'customer-db'
    });
  });

  it('gets DBaaS details through the cluster detail path', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        id: 7869,
        master_node: {
          cluster_id: 7869,
          database: {
            database: 'appdb',
            id: 11,
            pg_detail: {},
            username: 'admin'
          }
        },
        name: 'customer-db',
        software: {
          engine: 'Relational',
          id: 301,
          name: 'MySQL',
          version: '8.0'
        }
      })
    );

    const result = await client.getDbaas(7869);

    expect(transport.getMock).toHaveBeenCalledWith(
      '/rds/cluster/7869/',
      undefined
    );
    expect(result.id).toBe(7869);
  });

  it('resets DBaaS passwords through the reset-password path', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);
    const body: DbaasResetPasswordRequest = {
      password: 'Password1!',
      username: 'admin'
    };

    transport.requestMock.mockResolvedValue(
      envelope(
        {
          cluster_id: 7869,
          name: 'customer-db'
        },
        {
          message: 'Password reset request processed successfully.'
        }
      )
    );

    const result = await client.resetPassword(7869, body);

    expect(transport.requestMock).toHaveBeenCalledWith({
      body,
      method: 'PUT',
      path: '/rds/cluster/7869/reset-password/'
    });
    expect(result).toEqual({
      cluster_id: 7869,
      message: 'Password reset request processed successfully.',
      name: 'customer-db'
    });
  });

  it('deletes DBaaS clusters through the cluster detail path', async () => {
    const transport = new StubTransport();
    const client = new DbaasApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope({
        cluster_id: 7869,
        name: 'customer-db'
      })
    );

    const result = await client.deleteDbaas(7869);

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/rds/cluster/7869/',
      undefined
    );
    expect(result).toEqual({
      cluster_id: 7869,
      name: 'customer-db'
    });
  });
});

function envelope<TData>(
  data: TData,
  options: {
    message?: string;
  } = {}
): ApiEnvelope<TData> {
  return {
    code: 200,
    data,
    errors: {},
    message: options.message ?? 'OK'
  };
}
