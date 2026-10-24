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
  program.hook('preAction', rejectUnknownSubcommand);
  prepareCommandForCli(program);
}

function prepareCommandForCli(command: Command): void {
  // A command group (one with subcommands) lets an unknown word through so
  // rejectUnknownSubcommand can name it, instead of Commander's "too many
  // arguments".
  command.allowExcessArguments(command.commands.length > 0);
  command.configureOutput({
    outputError: () => {},
    writeErr: () => {}
  });
  command.exitOverride();

  for (const subcommand of command.commands) {
    prepareCommandForCli(subcommand);
  }
}

function rejectUnknownSubcommand(
  _program: Command,
  actionCommand: Command
): void {
  const [unknownName] = actionCommand.args;

  if (actionCommand.commands.length === 0 || unknownName === undefined) {
    return;
  }

  const groupPath = formatCommandPath(actionCommand);
  const movedTo = findPlatformWithCommand(actionCommand, unknownName);
  throw new CliError(`Unknown command "${unknownName}".`, {
    code: 'UNKNOWN_COMMAND',
    exitCode: EXIT_CODES.usage,
    suggestion:
      movedTo === undefined
        ? `Run ${groupPath} --help to see the commands.`
        : `Commands now start with the platform name. Did you mean "${groupPath} ${movedTo.name()} ${unknownName}"?`
  });
}

// At the top level, an unknown word may be a product that now lives under a
// platform group, such as `node` under `myaccount`.
function findPlatformWithCommand(
  command: Command,
  name: string
): Command | undefined {
  if (command.parent !== null) {
    return undefined;
  }

  return command.commands.find((platform) =>
    platform.commands.some((product) => product.name() === name)
  );
}

function formatCommandPath(command: Command): string {
  const names: string[] = [];

  for (
    let current: Command | null = command;
    current !== null;
    current = current.parent
  ) {
    names.unshift(current.name());
  }

  return names.join(' ');
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
