// API quirks:
// - service=notebook lists the plans for container instances.
// - The reply is grouped by series, with yes/no flags mixed in; see
//   TirPlanApiGroups.
// - The API accepts any location here, so the CLI checks it itself.
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { TirPlanApiGroups } from './types.js';

const PLANS_PATH = '/gpu_service/sku/';

export interface TirPlanClient {
  listPlans(imageVersionId?: number): Promise<TirPlanApiGroups>;
}

export class TirPlanApiClient implements TirPlanClient {
  constructor(private readonly transport: ApiTransport) {}

  async listPlans(imageVersionId?: number): Promise<TirPlanApiGroups> {
    const response = await this.transport.get<ApiEnvelope<TirPlanApiGroups>>(
      PLANS_PATH,
      {
        query: {
          image_version_id:
            imageVersionId === undefined ? undefined : String(imageVersionId),
          service: 'notebook'
        }
      }
    );

    return response.data;
  }
}
