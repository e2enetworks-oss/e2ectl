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
  it('creates a project via POST to the PBAC collection route', async () => {
    const transport = new StubTransport();
    const client = new ProjectApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope({
        project_id: 99001,
        project_name: 'new-project'
      })
    );

    const result = await client.createProject({ name: 'new-project' });

    expect(transport.postMock).toHaveBeenCalledWith('/pbac/project/', {
      body: { name: 'new-project' },
      includeProjectContext: false
    });
    expect(result).toEqual({
      project_id: 99001,
      project_name: 'new-project'
    });
  });

  it('stars a project via PUT to the PBAC collection route', async () => {
    const transport = new StubTransport();
    const client = new ProjectApiClient(transport);

    transport.requestMock.mockResolvedValue(
      envelope({
        project_id: 46429,
        project_name: 'default-project'
      })
    );

    const result = await client.starUnstarProject({
      is_starred: true,
      name: 'default-project',
      project_id: 46429
    });

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: { is_starred: true, name: 'default-project', project_id: 46429 },
      includeProjectContext: false,
      method: 'PUT',
      path: '/pbac/project/'
    });
    expect(result).toEqual({
      project_id: 46429,
      project_name: 'default-project'
    });
  });

  it('lists projects through the account-scoped PBAC collection route', async () => {
    const transport = new StubTransport();
    const client = new ProjectApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
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
