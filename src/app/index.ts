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
    rejectUnknownCommand(program, argv.slice(2));
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

// Checks the command words typed (before any option) against the command
// tree before Commander parses, so an unknown word is named the same way at
// every level and whether or not options follow it. Every command group
// shows its help when run on its own, which stops Commander from reporting
// unknown words itself. Hints repeat only command words, never option
// values, so a password typed on the line is not echoed back.
function rejectUnknownCommand(program: Command, args: string[]): void {
  const words = readCommandWords(program, args);
  let group = program;

  for (const [index, word] of words.entries()) {
    if (group.commands.length === 0) {
      return;
    }

    if (word === 'help') {
      continue;
    }

    const next = group.commands.find(
      (command) => command.name() === word || command.aliases().includes(word)
    );
    if (next === undefined) {
      throw unknownCommandError(group, word, words.slice(index + 1));
    }

    group = next;
  }
}

// Top-level options such as --json take no value, so they are skipped
// wherever they appear. Any other option ends the command words: what
// follows belongs to that option or to the command itself.
function readCommandWords(program: Command, args: string[]): string[] {
  const words: string[] = [];

  for (const arg of args) {
    const isTopLevelOption = program.options.some(
      (option) => option.long === arg || option.short === arg
    );
    if (isTopLevelOption) {
      continue;
    }

    if (arg.startsWith('-')) {
      break;
    }

    words.push(arg);
  }

  return words;
}

function unknownCommandError(
  group: Command,
  word: string,
  laterWords: string[]
): CliError {
  const groupPath = formatCommandPath(group);
  const closest = findClosestCommandName(group, word);
  const moved =
    group.parent === null ? findMovedProduct(group, word, closest) : undefined;

  let suggestion = `Run ${groupPath} --help to see the commands.`;
  if (moved !== undefined) {
    const commandPath = followSubcommands(moved.platform, [
      moved.productName,
      ...laterWords
    ]);
    suggestion = `Commands now start with the platform name. Did you mean "${commandPath}"?`;
  } else if (closest !== undefined) {
    suggestion = `Did you mean "${groupPath} ${closest}"? Run ${groupPath} --help to see the commands.`;
  }

  return new CliError(`Unknown command "${word}".`, {
    code: 'UNKNOWN_COMMAND',
    exitCode: EXIT_CODES.usage,
    suggestion
  });
}

// Builds "e2ectl <platform> <product> <subcommand> ..." from the typed words,
// stopping at the first word that is not a subcommand. Only command names
// are repeated: a value typed in the wrong place (even a password) is not.
function followSubcommands(platform: Command, words: string[]): string {
  const path = [formatCommandPath(platform)];
  let group = platform;

  for (const word of words) {
    const next = group.commands.find((command) => command.name() === word);
    if (next === undefined) {
      break;
    }

    path.push(word);
    group = next;
  }

  return path.join(' ');
}

// At the top level, a word may be a product that moved under a platform
// (`node` is now `myaccount node`), or a near miss of one (`nod`). A near
// miss of a top-level command (`confg`) wins over a near miss of a product.
function findMovedProduct(
  program: Command,
  word: string,
  closestTopLevelName: string | undefined
): { platform: Command; productName: string } | undefined {
  const exact = findPlatformWithProduct(program, word);
  if (exact !== undefined) {
    return { platform: exact, productName: word };
  }

  if (closestTopLevelName !== undefined) {
    return undefined;
  }

  for (const platform of program.commands) {
    const productName = findClosestCommandName(platform, word);
    if (
      productName !== undefined &&
      findPlatformWithProduct(program, productName) === platform
    ) {
      return { platform, productName };
    }
  }

  return undefined;
}

// A platform is a top-level group whose commands have commands of their own
// (myaccount > node > list). config is not one: its commands are leaves.
function findPlatformWithProduct(
  program: Command,
  productName: string
): Command | undefined {
  return program.commands.find((platform) =>
    platform.commands.some(
      (product) => product.name() === productName && product.commands.length > 0
    )
  );
}

// The nearest command name within two edits (nod -> node, lst -> list).
function findClosestCommandName(
  group: Command,
  word: string
): string | undefined {
  let closest: { distance: number; name: string } | undefined;

  for (const command of group.commands) {
    const distance = editDistance(word, command.name());
    if (
      distance <= 2 &&
      (closest === undefined || distance < closest.distance)
    ) {
      closest = { distance, name: command.name() };
    }
  }

  return closest?.name;
}

// Number of single-letter inserts, deletes or changes that turn one word
// into the other.
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const changeCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + changeCost
      );
    }
    previous = current;
  }

  return previous[right.length] ?? 0;
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
      error.code === 'commander.version' ||
      (error.code === 'commander.help' && error.exitCode === 0))
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
