import { readFile, rm, writeFile } from 'node:fs/promises';

import { runBuiltCli } from '../../helpers/process.js';
import type { DbaasManualEnv } from './dbaas-env.js';
import type { DbaasSmokeManifest } from './dbaas-helpers.js';

export const MANUAL_DESTRUCTIVE_COMMAND_TIMEOUT_MS = 120 * 1000;

const REDACTED = '<redacted>';
const SECRET_VALUE_FLAGS = new Set(['--password']);

export interface DbaasJsonCommandOptions {
  sensitiveValues?: string[];
  stdin?: string;
  timeoutMs?: number;
}

interface DbaasPasswordCommand {
  args: string[];
  sensitiveValues: string[];
  stdin: string;
}

export interface DbaasCleanupResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type DbaasJsonCommandRunner = (
  args: string[],
  dbaasEnv: DbaasManualEnv,
  options?: DbaasJsonCommandOptions
) => Promise<unknown>;

interface DbaasCleanupOptions {
  runJsonCommand?: DbaasJsonCommandRunner;
}

export function buildDbaasCreatePasswordCommand(options: {
  databaseName: string;
  name: string;
  password: string;
  plan: string;
  type: string;
  version: string;
  vpcId: number;
}): DbaasPasswordCommand {
  return {
    args: [
      'dbaas',
      'create',
      '--name',
      options.name,
      '--type',
      options.type,
      '--db-version',
      options.version,
      '--plan',
      options.plan,
      '--database-name',
      options.databaseName,
      '--password-file',
      '-',
      '--vpc-id',
      String(options.vpcId),
      '--public-ip'
    ],
    sensitiveValues: [options.password],
    stdin: `${options.password}\n`
  };
}

export function buildDbaasResetPasswordCommand(options: {
  dbaasId: number;
  password: string;
}): DbaasPasswordCommand {
  return {
    args: [
      'dbaas',
      'reset-password',
      String(options.dbaasId),
      '--password-file',
      '-'
    ],
    sensitiveValues: [options.password],
    stdin: `${options.password}\n`
  };
}

export async function runDbaasJsonCommand<T>(
  args: string[],
  dbaasEnv: DbaasManualEnv,
  options: DbaasJsonCommandOptions = {}
): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: dbaasEnv.cliEnv,
    ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
    timeoutMs: options.timeoutMs ?? MANUAL_DESTRUCTIVE_COMMAND_TIMEOUT_MS
  });

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: ${formatDbaasCommand(args)}`,
        formatCommandOutput('STDERR', result.stderr, options.sensitiveValues),
        formatCommandOutput('STDOUT', result.stdout, options.sensitiveValues)
      ].join('\n')
    );
  }

  return parseJsonCommandResult<T>(args, result.stdout);
}

export async function runDbaasDestructiveCleanup(
  context: { dbaasEnv: DbaasManualEnv; manifestPath: string },
  dbaasId: number | undefined,
  vpcId: number | undefined,
  options: DbaasCleanupOptions = {}
): Promise<DbaasCleanupResult> {
  const runJsonCommand =
    options.runJsonCommand ??
    (async (args, dbaasEnv, commandOptions) =>
      await runDbaasJsonCommand(args, dbaasEnv, commandOptions));
  const stderr: string[] = [];

  let manifest: DbaasSmokeManifest | undefined;
  try {
    const content = await readFile(context.manifestPath, 'utf8');
    manifest = JSON.parse(content) as DbaasSmokeManifest;
  } catch (error: unknown) {
    stderr.push(
      `Could not read DBaaS cleanup manifest ${context.manifestPath}: ${formatError(error)}`
    );
  }

  const dbaasToDelete = dbaasId ?? manifest?.dbaas_id ?? undefined;
  const vpcToDelete = vpcId ?? manifest?.vpc_id ?? undefined;

  let dbaasDeleteFailed = false;
  let vpcDeleteFailed = false;

  if (dbaasToDelete && !manifest?.dbaas_deleted) {
    if (vpcToDelete && manifest?.vpc_attached && manifest.public_ip_attached) {
      await tryBestEffortCleanup(
        runJsonCommand,
        context.dbaasEnv,
        [
          'dbaas',
          'network',
          String(dbaasToDelete),
          'detach-vpc',
          String(vpcToDelete)
        ],
        stderr
      );
    }

    try {
      await runJsonCommand(
        ['dbaas', 'delete', String(dbaasToDelete), '--force'],
        context.dbaasEnv
      );
      if (manifest !== undefined) {
        manifest.dbaas_deleted = true;
        manifest.dbaas_id = null;
      }
    } catch (error: unknown) {
      dbaasDeleteFailed = true;
      stderr.push(
        `Failed to delete DBaaS ${dbaasToDelete}: ${formatError(error)}`
      );
    }
  }

  if (vpcToDelete && !manifest?.vpc_deleted) {
    try {
      await runJsonCommand(
        ['vpc', 'delete', String(vpcToDelete), '--force'],
        context.dbaasEnv
      );
      if (manifest !== undefined) {
        manifest.vpc_deleted = true;
        manifest.vpc_id = null;
      }
    } catch (error: unknown) {
      vpcDeleteFailed = true;
      stderr.push(`Failed to delete VPC ${vpcToDelete}: ${formatError(error)}`);
    }
  }

  const shouldPreserveManifest =
    dbaasDeleteFailed || vpcDeleteFailed || stderr.length > 0;

  if (manifest !== undefined && shouldPreserveManifest) {
    await writeFile(
      context.manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  if (!shouldPreserveManifest) {
    try {
      await rm(context.manifestPath);
    } catch (error: unknown) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Failed to remove DBaaS cleanup manifest ${context.manifestPath}: ${formatError(error)}`
      };
    }
  }

  return {
    exitCode: shouldPreserveManifest ? 1 : 0,
    stdout:
      shouldPreserveManifest && (dbaasToDelete || vpcToDelete)
        ? `Preserved DBaaS cleanup manifest: ${context.manifestPath}`
        : '',
    stderr: stderr.join('\n')
  };
}

export function redactCliArgs(args: string[]): string[] {
  const redacted: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      if (SECRET_VALUE_FLAGS.has(flag)) {
        redacted.push(`${flag}=${REDACTED}`);
        continue;
      }
    }

    redacted.push(arg);

    if (SECRET_VALUE_FLAGS.has(arg) && index + 1 < args.length) {
      redacted.push(REDACTED);
      index += 1;
    }
  }

  return redacted;
}

function parseJsonCommandResult<T>(args: string[], stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (error: unknown) {
    throw new Error(
      `Command returned invalid JSON for ${formatDbaasCommand(args)}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function formatDbaasCommand(args: string[]): string {
  return `e2ectl ${redactCliArgs(args).join(' ')}`;
}

function formatCommandOutput(
  label: string,
  value: string,
  sensitiveValues: string[] | undefined
): string {
  const trimmed = redactSensitiveValues(value.trim(), sensitiveValues);

  return trimmed.length === 0 ? `${label}: <empty>` : `${label}: ${trimmed}`;
}

function redactSensitiveValues(
  value: string,
  sensitiveValues: string[] | undefined
): string {
  let redacted = value;

  for (const sensitiveValue of sensitiveValues ?? []) {
    if (sensitiveValue.trim().length === 0) {
      continue;
    }

    redacted = redacted.split(sensitiveValue).join(REDACTED);
  }

  return redacted;
}

async function tryBestEffortCleanup(
  runJsonCommand: DbaasJsonCommandRunner,
  dbaasEnv: DbaasManualEnv,
  args: string[],
  stderr: string[]
): Promise<void> {
  try {
    await runJsonCommand(args, dbaasEnv);
  } catch (error: unknown) {
    stderr.push(
      `Best-effort cleanup failed for ${formatDbaasCommand(args)}: ${formatError(error)}`
    );
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
