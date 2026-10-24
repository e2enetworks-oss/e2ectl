// API quirks:
// - category=notebook with not_app_name=vm returns the container images
//   (pre-built and base OS); VM images wait for the tir vm commands.
// - is_advanced_search=true is needed to get versions nested under each image.
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { TirImageApiItem } from './types.js';

const IMAGES_PATH = '/gpu_service/image/';

export interface TirImageClient {
  listImages(): Promise<TirImageApiItem[]>;
}

export class TirImageApiClient implements TirImageClient {
  constructor(private readonly transport: ApiTransport) {}

  async listImages(): Promise<TirImageApiItem[]> {
    const response = await this.transport.get<ApiEnvelope<TirImageApiItem[]>>(
      IMAGES_PATH,
      {
        query: {
          category: 'notebook',
          is_advanced_search: 'true',
          not_app_name: 'vm'
        }
      }
    );

    return response.data;
  }
}
