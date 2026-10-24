import path from 'node:path';

import {
  runProcess,
  type ProcessOptions as CliProcessOptions,
  type ProcessResult as CliProcessResult
} from '../../scripts/helpers/process.mjs';

const CLI_ENTRYPOINT = path.join(process.cwd(), 'dist', 'app', 'index.js');

// The built CLI must not pick up the E2E settings of the shell running the
// tests (it could call the real API with a real key). Undefined values are
// left out of the child's environment; a test sets what it needs.
const CLEARED_E2E_ENV = {
  E2E_API_KEY: undefined,
  E2E_AUTH_TOKEN: undefined,
  E2E_LOCATION: undefined,
  E2E_PROJECT_ID: undefined,
  E2E_TIR_ACCOUNT_ID: undefined,
  E2E_TIR_LOCATION: undefined,
  E2E_TIR_PROJECT_ID: undefined
};

export async function runBuiltCli(
  args: string[],
  options: CliProcessOptions = {}
): Promise<CliProcessResult> {
  return await runCommand(process.execPath, [CLI_ENTRYPOINT, ...args], {
    ...options,
    env: { ...CLEARED_E2E_ENV, ...options.env }
  });
}

export async function runCommand(
  command: string,
  args: string[],
  options: CliProcessOptions = {}
): Promise<CliProcessResult> {
  return await runProcess(command, args, options);
}
