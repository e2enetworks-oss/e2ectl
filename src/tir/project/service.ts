import {
  TIR_CONTEXT_ENV_VAR_BY_FIELD,
  resolveStoredTirCredentials,
  type ConfigFile,
  type PlatformSetupSteps,
  type ResolvedTirCredentials
} from '../../config/index.js';
import type { TirAccountClient } from '../account/index.js';
import { toTirAccountItem } from '../account/index.js';
import { formatTirCommand } from '../api.js';
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

// TIR's part of the shared setup (tir configure and e2ectl configure):
// accounts, the projects in an account, and where the choice is saved.
export function createTirSetupSteps(clients: {
  accounts: TirAccountClient;
  projects: TirProjectClient;
}): PlatformSetupSteps {
  return {
    envVarNames: {
      account: TIR_CONTEXT_ENV_VAR_BY_FIELD.account_id,
      location: TIR_CONTEXT_ENV_VAR_BY_FIELD.location,
      project: TIR_CONTEXT_ENV_VAR_BY_FIELD.project_id
    },
    listAccounts: async () =>
      (await clients.accounts.listAccounts()).map((account) => {
        const item = toTirAccountItem(account);
        return {
          email: item.email,
          id: item.id,
          name: item.name,
          usable: item.tir_access
        };
      }),
    listCommands: {
      account: formatTirCommand('account list'),
      project: formatTirCommand('project list --account-id <id>')
    },
    listProjects: async (accountId) =>
      (await clients.projects.listProjects(String(accountId ?? ''))).map(
        toTirProjectItem
      ),
    platform: 'tir',
    readSaved: (profile) => ({
      account: profile.tir?.account_id,
      location: profile.tir?.location,
      project: profile.tir?.project_id
    }),
    toProfilePatch: (context) => ({
      tir: {
        account_id: String(context.accountId ?? ''),
        location: context.location,
        project_id: String(context.projectId)
      }
    })
  };
}

function toTirProjectItem(project: TirProjectApiItem): TirProjectItem {
  return {
    created_at: project.created_at ?? '',
    id: project.project_id,
    name: project.project_name
  };
}
