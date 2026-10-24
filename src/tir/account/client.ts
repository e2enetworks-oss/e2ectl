// API quirks:
// - Accounts are IAM memberships; the id is what other calls take as
//   active_iam.
// - The list needs no account, project or location of its own.
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { TirAccountApiItem } from './types.js';

const ACCOUNTS_PATH = '/users/iam-accounts/';

export interface TirAccountClient {
  listAccounts(): Promise<TirAccountApiItem[]>;
}

export class TirAccountApiClient implements TirAccountClient {
  constructor(private readonly transport: ApiTransport) {}

  async listAccounts(): Promise<TirAccountApiItem[]> {
    const response = await this.transport.get<ApiEnvelope<TirAccountApiItem[]>>(
      ACCOUNTS_PATH,
      { includeProjectContext: false }
    );

    return response.data;
  }
}
