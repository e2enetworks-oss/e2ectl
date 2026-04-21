import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { ImageApiClient } from '../../../src/image/client.js';

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

function makeImageSummary(overrides = {}) {
  return {
    creation_time: '01-Jan-2025 10:00:00',
    image_id: '1001',
    image_name: 'my-image',
    image_size: '20GB',
    image_state: 'READY',
    is_windows: false,
    node_plans_available: true,
    os_distribution: 'Ubuntu 22.04',
    project_name: 'default-project',
    running_vms: 2,
    scaler_group_count: 1,
    ...overrides
  };
}

describe('ImageApiClient', () => {
  it('lists saved images through the saved-images path', async () => {
    const transport = new StubTransport();
    const client = new ImageApiClient(transport);

    transport.getMock.mockResolvedValue(envelope([makeImageSummary()]));

    const result = await client.listImages();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/images/saved-images/',
      undefined
    );
    expect(result[0]?.image_id).toBe('1001');
    expect(result[0]?.image_name).toBe('my-image');
  });

  it('gets a single image by id', async () => {
    const transport = new StubTransport();
    const client = new ImageApiClient(transport);

    transport.getMock.mockResolvedValue(envelope(makeImageSummary()));

    const result = await client.getImage('1001');

    expect(transport.getMock).toHaveBeenCalledWith('/images/1001/', undefined);
    expect(result.image_id).toBe('1001');
  });

  it('deletes an image and returns the response message', async () => {
    const transport = new StubTransport();
    const client = new ImageApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope({}, { message: 'Image deleted successfully' })
    );

    const result = await client.deleteImage('1001');

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/images/1001/',
      undefined
    );
    expect(result.message).toBe('Image deleted successfully');
  });

  it('renames an image via PUT with action_type rename', async () => {
    const transport = new StubTransport();
    const client = new ImageApiClient(transport);

    transport.requestMock.mockResolvedValue(
      envelope({ message: 'Image name changed successfully', status: true })
    );

    const result = await client.renameImage('1001', 'new-name');

    expect(transport.requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { action_type: 'rename', name: 'new-name' },
        method: 'PUT',
        path: '/images/1001/'
      })
    );
    expect(result.message).toBe('Image name changed successfully');
    expect(result.status).toBe(true);
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
