export interface ProcessResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
}

export function runProcess(
  command: string,
  args: string[],
  options?: ProcessOptions
): Promise<ProcessResult>;
