import {
  resolveStoredTirCredentials,
  type CredentialResolutionStore,
  type ResolvedTirCredentials
} from '../../config/index.js';
import type { TirAccountClient } from './client.js';
import type {
  TirAccountApiItem,
  TirAccountContextOptions,
  TirAccountItem,
  TirAccountListCommandResult
} from './types.js';

export interface TirAccountServiceDependencies {
  createTirAccountClient(credentials: ResolvedTirCredentials): TirAccountClient;
  store: CredentialResolutionStore;
}

export class TirAccountService {
  constructor(private readonly dependencies: TirAccountServiceDependencies) {}

  async list(
    options: TirAccountContextOptions
  ): Promise<TirAccountListCommandResult> {
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      options,
      'auth'
    );
    const client = this.dependencies.createTirAccountClient(credentials);

    return {
      action: 'list',
      items: (await client.listAccounts()).map(toTirAccountItem)
    };
  }
}

export function toTirAccountItem(account: TirAccountApiItem): TirAccountItem {
  return {
    email: account.owner?.email ?? '',
    id: account.id,
    name: account.owner?.name ?? '',
    role: account.role ?? '',
    tir_access: account.has_tir_access === true
  };
}
