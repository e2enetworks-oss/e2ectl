// API quirks:
// - The list is per account (active_iam); projects are not tied to a
//   location, so the list needs no project or location.
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { TirProjectApiItem } from './types.js';

const PROJECTS_PATH = '/projects/';

export interface TirProjectClient {
  listProjects(accountId: string): Promise<TirProjectApiItem[]>;
}

export class TirProjectApiClient implements TirProjectClient {
  constructor(private readonly transport: ApiTransport) {}

  async listProjects(accountId: string): Promise<TirProjectApiItem[]> {
    const response = await this.transport.get<ApiEnvelope<TirProjectApiItem[]>>(
      PROJECTS_PATH,
      { includeProjectContext: false, query: { active_iam: accountId } }
    );

    return response.data;
  }
}
