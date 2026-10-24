import type { CliRuntime } from '../../app/runtime.js';
import {
  CONTEXT_ENV_VAR_BY_FIELD,
  configurePlatform,
  createSetupIo,
  findSetupProfile,
  resolveStoredAccountCredentials,
  type PlatformConfigureCommandResult,
  type PlatformConfigureInput,
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
  input: PlatformConfigureInput,
  canPrompt: boolean
): Promise<PlatformConfigureCommandResult> {
  const alias = await findSetupProfile(runtime.store, input.alias);
  const credentials = await resolveStoredAccountCredentials(runtime.store, {
    alias
  });
  const steps = createMyAccountSetupSteps(
    runtime.createProjectClient(credentials)
  );
  const result = await configurePlatform(steps, alias, input, {
    io: createSetupIo(runtime, canPrompt),
    store: runtime.store
  });

  return { action: 'configure', alias, ...result };
}
