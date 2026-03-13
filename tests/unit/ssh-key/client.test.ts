import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { SshKeyApiClient } from '../../../src/ssh-key/client.js';

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

describe('SshKeyApiClient', () => {
  it('lists SSH keys through the settings path', async () => {
    const transport = new StubTransport();
    const client = new SshKeyApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          label: 'admin@laptop',
          pk: 15398,
          project_name: 'default-project',
          ssh_key: 'ssh-ed25519 AAAAC3Nza admin@laptop',
          ssh_key_type: 'ED25519',
          timestamp: '19-Feb-2025',
          total_attached_nodes: 1
        }
      ])
    );

    const result = await client.listSshKeys();

    expect(transport.getMock).toHaveBeenCalledWith('/ssh_keys/', undefined);
    expect(result[0]?.pk).toBe(15398);
  });

  it('creates SSH keys through the settings path', async () => {
    const transport = new StubTransport();
    const client = new SshKeyApiClient(transport);

    transport.postMock.mockResolvedValue(
      envelope({
        label: 'admin@laptop',
        pk: 15398,
        project_id: '46429',
        ssh_key: 'ssh-ed25519 AAAAC3Nza admin@laptop',
        timestamp: '19-Feb-2025'
      })
    );

    const result = await client.createSshKey({
      label: 'admin@laptop',
      ssh_key: 'ssh-ed25519 AAAAC3Nza admin@laptop'
    });

    expect(transport.postMock).toHaveBeenCalledWith('/ssh_keys/', {
      body: {
        label: 'admin@laptop',
        ssh_key: 'ssh-ed25519 AAAAC3Nza admin@laptop'
      }
    });
    expect(result.project_id).toBe('46429');
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
