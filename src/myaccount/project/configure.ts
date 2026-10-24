import type { CliRuntime } from '../../app/runtime.js';
import {
  CONTEXT_ENV_VAR_BY_FIELD,
  configurePlatform,
  resolveStoredAccountCredentials,
  type PlatformConfigureOutcome,
  type PlatformConfigureRequest,
  type PlatformSetupSteps
} from '../../config/index.js';
import { formatMyAccountCommand } from '../api.js';
import type { ProjectClient } from './client.js';

// MyAccount's part of the shared setup (myaccount configure and e2ectl
// configure): its projects, and where the choice is saved.
export function createMyAccountSetupSteps(
  projects: ProjectClient
): PlatformSetupSteps {
  return {
    envVarNames: {
      location: CONTEXT_ENV_VAR_BY_FIELD.location,
      project: CONTEXT_ENV_VAR_BY_FIELD.project_id
    },
    listCommands: { project: formatMyAccountCommand('project list') },
    listProjects: async () =>
      (await projects.listProjects()).map((project) => ({
        id: project.project_id,
        name: project.name
      })),
    platform: 'myaccount',
    readSaved: (profile) => ({
      location: profile.default_location,
      project: profile.default_project_id
    }),
    toProfilePatch: (context) => ({
      default_location: context.location,
      default_project_id: String(context.projectId)
    })
  };
}

// myaccount configure: the shared setup with MyAccount's steps. e2ectl
// configure calls this too.
export async function configureMyAccount(
  runtime: CliRuntime,
  request: PlatformConfigureRequest
): Promise<PlatformConfigureOutcome> {
  return await configurePlatform(request, runtime, async (keySource) => {
    const credentials = await resolveStoredAccountCredentials(
      runtime.store,
      keySource
    );
    return createMyAccountSetupSteps(runtime.createProjectClient(credentials));
  });
}
