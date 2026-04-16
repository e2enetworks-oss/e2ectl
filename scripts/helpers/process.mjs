import { spawn } from 'node:child_process';
import process from 'node:process';

export async function runProcess(command, args, options = {}) {
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new Error(
      'Process timeout must be a positive number when it is set.'
    );
  }

  const startTime = Date.now();
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
  let didTimeout = false;
  let timeoutId;

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  if (options.stdin !== undefined) {
    if (child.stdin === null) {
      throw new Error('Expected child process stdin pipe.');
    }

    child.stdin.end(options.stdin);
  }

  if (options.timeoutMs !== undefined) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      child.kill('SIGTERM');

      const forceKillId = setTimeout(() => {
        child.kill('SIGKILL');
      }, 1_000);
      forceKillId.unref();
    }, options.timeoutMs);
    timeoutId.unref();
  }

  return await new Promise((resolve, reject) => {
    child.once('error', (error) => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      reject(error);
    });

    child.once('close', (exitCode) => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      const elapsedMs = Date.now() - startTime;

      if (didTimeout) {
        reject(
          new Error(
            [
              `Command timed out after ${elapsedMs}ms.`,
              `Command: ${command}`,
              `Args: ${args.join(' ')}`
            ].join('\n')
          )
        );
        return;
      }

      resolve({
        exitCode: exitCode ?? 1,
        stderr,
        stdout
      });
    });
  });
}
