import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { VolumeApiClient } from '../../../src/volume/client.js';
import type { VolumeCreateRequest } from '../../../src/volume/index.js';

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

describe('VolumeApiClient', () => {
  it('creates volumes through the block storage collection path', async () => {
    const transport = new StubTransport();
    const client = new VolumeApiClient(transport);
    const request: VolumeCreateRequest = {
      cn_id: 31,
      cn_status: 'hourly_billing',
      iops: 5000,
      name: 'data-01',
      size: 250
    };

    transport.postMock.mockResolvedValue(
      envelope({
        id: 25550,
        image_name: 'data-01'
      })
    );

    const result = await client.createVolume(request);

    expect(transport.postMock).toHaveBeenCalledWith('/block_storage/', {
      body: request
    });
    expect(result).toEqual({
      id: 25550,
      image_name: 'data-01'
    });
  });

  it('reads volume plans from the backend discovery path', async () => {
    const transport = new StubTransport();
    const client = new VolumeApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          available_inventory_status: true,
          bs_size: 0.25,
          committed_sku: [],
          currency: 'INR',
          iops: 5000,
          name: '250 GB',
          price: 5
        }
      ])
    );

    const result = await client.listVolumePlans();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/block_storage/plans/',
      undefined
    );
    expect(result[0]).toMatchObject({
      bs_size: 0.25,
      iops: 5000
    });
  });

  it('requests paginated volume list data from the block storage path', async () => {
    const transport = new StubTransport();
    const client = new VolumeApiClient(transport);

    transport.getMock.mockResolvedValue({
      ...envelope([
        {
          block_id: 25550,
          name: 'data-01',
          size: 238419,
          size_string: '250 GB',
          status: 'Available',
          vm_detail: {}
        }
      ]),
      total_count: 1,
      total_page_number: 1
    });

    const result = await client.listVolumes(1, 100);

    expect(transport.getMock).toHaveBeenCalledWith('/block_storage/', {
      query: {
        page_no: '1',
        per_page: '100'
      }
    });
    expect(result).toEqual({
      items: [
        {
          block_id: 25550,
          name: 'data-01',
          size: 238419,
          size_string: '250 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 1
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
