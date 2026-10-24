import {
  resolveStoredTirCredentials,
  type ConfigFile,
  type ResolvedTirCredentials
} from '../../config/index.js';
import type { TirProjectClient } from './client.js';
import type {
  TirProjectApiItem,
  TirProjectContextOptions,
  TirProjectItem,
  TirProjectListCommandResult
} from './types.js';

interface TirProjectStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface TirProjectServiceDependencies {
  createTirProjectClient(credentials: ResolvedTirCredentials): TirProjectClient;
  store: TirProjectStore;
}

export class TirProjectService {
  constructor(private readonly dependencies: TirProjectServiceDependencies) {}

  async list(
    options: TirProjectContextOptions
  ): Promise<TirProjectListCommandResult> {
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      options,
      'account'
    );
    const accountId = credentials.account_id ?? '';
    const client = this.dependencies.createTirProjectClient(credentials);

    return {
      account_id: Number(accountId),
      action: 'list',
      items: (await client.listProjects(accountId)).map(toTirProjectItem)
    };
  }
}

function toTirProjectItem(project: TirProjectApiItem): TirProjectItem {
  return {
    created_at: project.created_at ?? '',
    id: project.project_id,
    name: project.project_name
  };
}
