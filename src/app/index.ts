#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';

import {
  CliError,
  EXIT_CODES,
  formatError,
  isCliError
} from '../core/errors.js';
import { createProgram } from './program.js';
import {
  createRuntime,
  type CliRuntime,
  type OutputWriter
} from './runtime.js';

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv);
}

if (isMainModule()) {
  void main();
}

export async function runCli(
  argv: string[],
  runtime: CliRuntime = createRuntime(),
  stderr: OutputWriter = process.stderr
): Promise<number> {
  const program = createProgram(runtime);
  prepareProgramForCli(program);

  try {
    rejectRetiredLoadBalancerCommands(argv);
    await program.parseAsync(argv);
    return EXIT_CODES.success;
  } catch (error: unknown) {
    if (isCommanderSuccessExit(error)) {
      return EXIT_CODES.success;
    }

    const normalizedError = normalizeCliExecutionError(error);
    stderr.write(formatError(normalizedError));

    return isCliError(normalizedError)
      ? normalizedError.exitCode
      : EXIT_CODES.general;
  }
}

function rejectRetiredLoadBalancerCommands(argv: string[]): void {
  const positional = argv.slice(2).filter((value) => !value.startsWith('-'));
  const [command, firstNested, secondNested] = positional;

  if (command === 'load-balancer') {
    throw new CliError('Unknown command "load-balancer".', {
      code: 'INVALID_USAGE',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Use "lb" instead.'
    });
  }

  if (
    command === 'lb' &&
    firstNested === 'backend' &&
    (secondNested === 'group' || secondNested === 'server')
  ) {
    throw new CliError(`Unknown command "lb backend ${secondNested}".`, {
      code: 'INVALID_USAGE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        secondNested === 'group'
          ? 'Use "lb backend-group" instead.'
          : 'Use "lb backend-server" instead.'
    });
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];

  return (
    entrypoint !== undefined &&
    pathsReferToSameFile(entrypoint, fileURLToPath(import.meta.url))
  );
}

export function pathsReferToSameFile(
  leftPath: string,
  rightPath: string
): boolean {
  return (
    resolvePathForMainCheck(leftPath) === resolvePathForMainCheck(rightPath)
  );
}

function prepareProgramForCli(program: Command): void {
  program.allowExcessArguments(false);
  program.configureOutput({
    outputError: () => {},
    writeErr: () => {}
  });
  program.exitOverride();

  for (const command of program.commands) {
    prepareProgramForCli(command);
  }
}

function isCommanderSuccessExit(error: unknown): error is CommanderError {
  return (
    error instanceof CommanderError &&
    (error.code === 'commander.helpDisplayed' ||
      error.code === 'commander.version')
  );
}

function normalizeCliExecutionError(error: unknown): unknown {
  if (error instanceof CommanderError) {
    return commanderErrorToCliError(error);
  }

  return error;
}

function commanderErrorToCliError(error: CommanderError): CliError {
  const [firstLine = 'Invalid command usage.', ...remainingLines] =
    error.message
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  return new CliError(stripCommanderErrorPrefix(firstLine), {
    code: 'INVALID_USAGE',
    ...(remainingLines.length === 0 ? {} : { details: remainingLines }),
    exitCode: EXIT_CODES.usage,
    suggestion: 'Run the command again with --help for usage.'
  });
}

function stripCommanderErrorPrefix(message: string): string {
  return message.replace(/^error:\s*/i, '');
}

function resolvePathForMainCheck(filePath: string): string {
  const absolutePath = path.resolve(filePath);

  try {
    return realpathSync(absolutePath);
  } catch {
    return absolutePath;
  }
}

export { createProgram } from './program.js';
export {
  createRuntime,
  type CliRuntime,
  type OutputWriter
} from './runtime.js';
