import type { CliRuntime } from '../../app/runtime.js';
import {
  configurePlatform,
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
    envVarNames: { location: 'E2E_LOCATION', project: 'E2E_PROJECT_ID' },
    listCommands: { project: formatMyAccountCommand('project list') },
    listProjects: async () =>
      (await projects.listProjects()).map((project) => ({
        id: project.project_id,
        name: project.name
      })),
    name: 'MyAccount',
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
    io: {
      canPrompt,
      env: process.env,
      prompt: (message) => runtime.prompt(message),
      write: (text) => {
        runtime.stdout.write(text);
      }
    },
    store: runtime.store
  });

  return { action: 'configure', alias, ...result };
}
