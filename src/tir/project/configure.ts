import type { CliRuntime } from '../../app/runtime.js';
import {
  configurePlatform,
  createSetupIo,
  findSetupProfile,
  resolveStoredTirCredentials,
  type PlatformConfigureCommandResult,
  type PlatformConfigureInput
} from '../../config/index.js';
import { createTirSetupSteps } from './service.js';

// tir configure: the shared setup with TIR's steps. e2ectl configure calls
// this too.
export async function configureTir(
  runtime: CliRuntime,
  input: PlatformConfigureInput,
  canPrompt: boolean
): Promise<PlatformConfigureCommandResult> {
  const alias = await findSetupProfile(runtime.store, input.alias);
  const credentials = await resolveStoredTirCredentials(
    runtime.store,
    { alias },
    'auth'
  );
  const steps = createTirSetupSteps({
    accounts: runtime.createTirAccountClient(credentials),
    projects: runtime.createTirProjectClient(credentials)
  });
  const result = await configurePlatform(steps, alias, input, {
    io: createSetupIo(runtime, canPrompt),
    store: runtime.store
  });

  return { action: 'configure', alias, ...result };
}
