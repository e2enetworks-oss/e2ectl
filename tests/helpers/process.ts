import path from 'node:path';

import {
  runProcess,
  type ProcessOptions as CliProcessOptions,
  type ProcessResult as CliProcessResult
} from '../../scripts/helpers/process.mjs';

const CLI_ENTRYPOINT = path.join(process.cwd(), 'dist', 'app', 'index.js');

export async function runBuiltCli(
  args: string[],
  options: CliProcessOptions = {}
): Promise<CliProcessResult> {
  return await runCommand(process.execPath, [CLI_ENTRYPOINT, ...args], options);
}

export async function runCommand(
  command: string,
  args: string[],
  options: CliProcessOptions = {}
): Promise<CliProcessResult> {
  return await runProcess(command, args, options);
}
