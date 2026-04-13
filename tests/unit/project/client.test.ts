import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { ProjectApiClient } from '../../../src/project/client.js';

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

describe('ProjectApiClient', () => {
  it('lists projects through the account-scoped PBAC collection route', async () => {
    const transport = new StubTransport();
    const client = new ProjectApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          associated_members: [],
          associated_policies: [],
          current_user_role: 'Owner',
          is_active_project: true,
          is_default: true,
          is_starred: false,
          name: 'default-project',
          project_id: 46429
        }
      ])
    );

    const result = await client.listProjects();

    expect(transport.getMock).toHaveBeenCalledWith('/pbac/project/', {
      includeProjectContext: false
    });
    expect(result[0]?.project_id).toBe(46429);
  });
});

function envelope<TData>(data: TData): ApiEnvelope<TData> {
  return {
    code: 200,
    data,
    errors: {},
    message: 'Success'
  };
}
