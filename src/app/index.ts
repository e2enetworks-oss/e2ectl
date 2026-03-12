#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatError, isCliError } from '../core/errors.js';
import { createProgram } from './program.js';
import { createRuntime } from './runtime.js';

async function main(): Promise<void> {
  const program = createProgram(createRuntime());

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    process.stderr.write(formatError(error));
    process.exitCode = isCliError(error) ? error.exitCode : 1;
  }
}

if (isMainModule()) {
  void main();
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];

  return (
    entrypoint !== undefined &&
    path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

export { createProgram } from './program.js';
export {
  createRuntime,
  type CliRuntime,
  type OutputWriter
} from './runtime.js';
