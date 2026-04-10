import { spawn } from 'node:child_process';
import path from 'node:path';

export interface CliProcessResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface CliProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
}

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
  const child = spawn(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      ...options.env
    },
    stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
  });

  if (child.stdout === null || child.stderr === null) {
    throw new Error('Expected child process stdout and stderr pipes.');
  }

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  if (options.stdin !== undefined) {
    if (child.stdin === null) {
      throw new Error('Expected child process stdin pipe.');
    }

    child.stdin.end(options.stdin);
  }

  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stderr,
        stdout
      });
    });
  });
}
