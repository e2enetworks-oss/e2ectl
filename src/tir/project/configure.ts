import type { CliRuntime } from '../../app/runtime.js';
import {
  TIR_CONTEXT_ENV_VAR_BY_FIELD,
  configurePlatform,
  resolveStoredTirCredentials,
  type PlatformConfigureOutcome,
  type PlatformConfigureRequest,
  type PlatformSetupSteps
} from '../../config/index.js';
import type { TirAccountClient } from '../account/index.js';
import { toTirAccountItem } from '../account/index.js';
import { formatTirCommand } from '../api.js';
import type { TirProjectClient } from './client.js';

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
        (project) => ({ id: project.project_id, name: project.project_name })
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

// tir configure: the shared setup with TIR's steps. e2ectl configure calls
// this too.
export async function configureTir(
  runtime: CliRuntime,
  request: PlatformConfigureRequest
): Promise<PlatformConfigureOutcome> {
  return await configurePlatform(request, runtime, async (keySource) => {
    const credentials = await resolveStoredTirCredentials(
      runtime.store,
      keySource,
      'auth'
    );
    return createTirSetupSteps({
      accounts: runtime.createTirAccountClient(credentials),
      projects: runtime.createTirProjectClient(credentials)
    });
  });
}
