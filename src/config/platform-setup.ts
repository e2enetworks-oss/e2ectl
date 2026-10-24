import { CliError, EXIT_CODES } from '../core/errors.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type { ConfigFile, ProfileConfig } from './types.js';
import { VALID_LOCATIONS } from './types.js';
import { findProfile } from './store.js';
import { pickValue } from './value-order.js';

export type SetupPlatform = 'myaccount' | 'tir';

export interface SetupAccount {
  email: string;
  id: number;
  name: string;
  // False when the platform is turned off for this account.
  usable: boolean;
}

export interface SetupProject {
  id: number;
  name: string;
}

// Raw values as typed on the command line, set in the environment or saved
// on the profile, before any check.
export interface SetupValues {
  account?: string | undefined;
  location?: string | undefined;
  project?: string | undefined;
}

export interface SetupContext {
  accountId?: number;
  location: string;
  projectId: number;
}

// What one platform plugs into the shared setup. Everything else (the
// order of the questions, the checks, the messages, the result) is shared,
// so tir configure and myaccount configure always behave the same way.
export interface PlatformSetupSteps {
  envVarNames: { account?: string; location: string; project: string };
  // Full commands for hints, for example "e2ectl tir project list".
  listCommands: { account?: string; project: string };
  // Only platforms with accounts (TIR) set this.
  listAccounts?: () => Promise<SetupAccount[]>;
  listProjects(accountId: number | undefined): Promise<SetupProject[]>;
  platform: SetupPlatform;
  readSaved(profile: ProfileConfig): SetupValues;
  toProfilePatch(context: SetupContext): Partial<ProfileConfig>;
}

export interface SetupIo {
  // False without a terminal or with --json: then every missing value is
  // an error naming the flag to add.
  canPrompt: boolean;
  env: NodeJS.ProcessEnv;
  prompt(message: string): Promise<string>;
  write(text: string): void;
}

interface SetupStore {
  read(): Promise<ConfigFile>;
  updateProfile(
    alias: string,
    patch: Partial<ProfileConfig>
  ): Promise<ConfigFile>;
}

export interface PlatformSetupResult {
  account: { email: string; id: number; name: string } | null;
  location: string;
  platform: SetupPlatform;
  project: SetupProject;
}

// What tir configure and myaccount configure take from the command line.
export interface PlatformConfigureInput extends SetupValues {
  alias?: string;
}

// The --json shape of tir configure and myaccount configure.
export interface PlatformConfigureCommandResult extends PlatformSetupResult {
  action: 'configure';
  alias: string;
}

const PLATFORM_NAMES: Record<SetupPlatform, string> = {
  myaccount: 'MyAccount',
  tir: 'TIR'
};

const FLAG_BY_VALUE: Record<keyof SetupValues, string> = {
  account: '--account',
  location: '--location',
  project: '--project'
};

// The prompts and output of the shared setup, from the CLI's terminal.
export function createSetupIo(
  terminal: {
    prompt(message: string): Promise<string>;
    stdout: { write(text: string): unknown };
  },
  canPrompt: boolean
): SetupIo {
  return {
    canPrompt,
    env: process.env,
    prompt: (message) => terminal.prompt(message),
    write: (text) => {
      terminal.stdout.write(text);
    }
  };
}

// The profile a configure command saves into: the --alias one, or the
// default profile.
export async function findSetupProfile(
  store: Pick<SetupStore, 'read'>,
  alias: string | undefined
): Promise<string> {
  const config = await store.read();
  const chosen = alias ?? config.default;

  if (chosen !== undefined && findProfile(config, chosen) !== undefined) {
    return chosen;
  }

  throw profileNotFoundError(
    chosen === undefined
      ? 'There is no saved profile to keep this setting in.'
      : `Profile "${chosen}" was not found.`
  );
}

function profileNotFoundError(message: string): CliError {
  return new CliError(message, {
    code: 'PROFILE_NOT_FOUND',
    exitCode: EXIT_CODES.config,
    suggestion:
      'Run `e2ectl configure` to save a key and token in a profile first.'
  });
}

export function renderPlatformSetupResult(
  result: PlatformConfigureCommandResult,
  json: boolean
): string {
  return json
    ? `${stableStringify(result as unknown as JsonValue)}\n`
    : `${describePlatformSetup(result.alias, result)}\n`;
}

// "TIR context saved for profile "work": account 12 (a@b.c), project 34
// (research), Delhi."
export function describePlatformSetup(
  alias: string,
  result: PlatformSetupResult
): string {
  const parts = [
    ...(result.account === null
      ? []
      : [
          `account ${result.account.id}${result.account.email.length > 0 ? ` (${result.account.email})` : ''}`
        ]),
    `project ${result.project.id} (${result.project.name})`,
    result.location
  ];

  return `${PLATFORM_NAMES[result.platform]} context saved for profile "${alias}": ${parts.join(', ')}.`;
}

// Asks for (or reads) the account, project and location, checks each one
// against the platform, and saves them on the profile. Nothing is saved
// unless every check passes.
export async function configurePlatform(
  steps: PlatformSetupSteps,
  alias: string,
  flags: SetupValues,
  dependencies: { io: SetupIo; store: SetupStore }
): Promise<PlatformSetupResult> {
  const { io, store } = dependencies;
  const profile = findProfile(await store.read(), alias);
  if (profile === undefined) {
    throw profileNotFoundError(`Profile "${alias}" was not found.`);
  }

  const saved = steps.readSaved(profile);
  const account = await chooseAccount(steps, flags, saved, io);
  // A saved project belongs to the saved account, so it is not offered
  // after switching to another account.
  const savedForAccount =
    account !== undefined && saved.account !== String(account.id)
      ? { ...saved, project: undefined }
      : saved;
  const project = await chooseProject(
    steps,
    account?.id,
    flags,
    savedForAccount,
    io
  );
  const location = await chooseLocation(steps, flags, saved, io);

  await store.updateProfile(
    alias,
    steps.toProfilePatch({
      ...(account === undefined ? {} : { accountId: account.id }),
      location,
      projectId: project.id
    })
  );

  return {
    account:
      account === undefined
        ? null
        : { email: account.email, id: account.id, name: account.name },
    location,
    platform: steps.platform,
    project
  };
}

async function chooseAccount(
  steps: PlatformSetupSteps,
  flags: SetupValues,
  saved: SetupValues,
  io: SetupIo
): Promise<SetupAccount | undefined> {
  if (steps.listAccounts === undefined) {
    return undefined;
  }

  const accounts = await steps.listAccounts();
  const usable = accounts.filter((account) => account.usable);
  const raw = await readValue(steps, 'account', flags, saved, io, {
    choices: accounts.map(
      (account) =>
        `${account.id}  ${account.email || account.name}${account.usable ? '' : `  (${PLATFORM_NAMES[steps.platform]} is off)`}`
    ),
    onlyChoice: usable.length === 1 ? String(usable[0]?.id) : undefined
  });
  const id = parseId(steps, 'account', raw);
  const found = accounts.find((account) => account.id === id);

  if (found === undefined) {
    throw new CliError(
      `${PLATFORM_NAMES[steps.platform]} account ${id} is not one your key can use.`,
      {
        code: 'SETUP_ACCOUNT_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run \`${steps.listCommands.account ?? ''}\` and pass a listed id with --account.`
      }
    );
  }

  if (!found.usable) {
    throw new CliError(
      `${PLATFORM_NAMES[steps.platform]} is not turned on for account ${id}.`,
      {
        code: 'SETUP_ACCOUNT_DISABLED',
        exitCode: EXIT_CODES.usage,
        suggestion: `Pick another account from \`${steps.listCommands.account ?? ''}\`, or ask its owner to turn ${PLATFORM_NAMES[steps.platform]} on.`
      }
    );
  }

  return found;
}

async function chooseProject(
  steps: PlatformSetupSteps,
  accountId: number | undefined,
  flags: SetupValues,
  saved: SetupValues,
  io: SetupIo
): Promise<SetupProject> {
  const projects = await steps.listProjects(accountId);
  if (projects.length === 0) {
    const where = accountId === undefined ? '' : ` in account ${accountId}`;
    throw new CliError(
      `There are no ${PLATFORM_NAMES[steps.platform]} projects${where}.`,
      {
        code: 'SETUP_NO_PROJECTS',
        exitCode: EXIT_CODES.usage,
        suggestion: `Create a project on ${PLATFORM_NAMES[steps.platform]} first, then run configure again.`
      }
    );
  }

  const raw = await readValue(steps, 'project', flags, saved, io, {
    choices: projects.map((project) => `${project.id}  ${project.name}`),
    onlyChoice: projects.length === 1 ? String(projects[0]?.id) : undefined
  });
  const id = parseId(steps, 'project', raw);
  const found = projects.find((project) => project.id === id);

  if (found === undefined) {
    const where = accountId === undefined ? '' : ` in account ${accountId}`;
    throw new CliError(
      `${PLATFORM_NAMES[steps.platform]} project ${id} was not found${where}.`,
      {
        code: 'SETUP_PROJECT_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run \`${steps.listCommands.project}\` and pass a listed id with --project.`
      }
    );
  }

  // Only the id and name, so every platform reports the same shape.
  return { id: found.id, name: found.name };
}

async function chooseLocation(
  steps: PlatformSetupSteps,
  flags: SetupValues,
  saved: SetupValues,
  io: SetupIo
): Promise<string> {
  const raw = await readValue(steps, 'location', flags, saved, io, {
    choices: [...VALID_LOCATIONS],
    onlyChoice: undefined
  });

  if (VALID_LOCATIONS.includes(raw as (typeof VALID_LOCATIONS)[number])) {
    return raw;
  }

  throw new CliError(
    `Unsupported ${PLATFORM_NAMES[steps.platform]} location "${raw}".`,
    {
      code: 'INVALID_LOCATION',
      details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass --location Delhi or --location Chennai.'
    }
  );
}

// A flag is used as it is. Otherwise the environment variable or the saved
// value is used; in a terminal it is offered as the default answer instead,
// so running configure again can change it.
async function readValue(
  steps: PlatformSetupSteps,
  field: keyof SetupValues,
  flags: SetupValues,
  saved: SetupValues,
  io: SetupIo,
  question: { choices: string[]; onlyChoice: string | undefined }
): Promise<string> {
  const envVarName = steps.envVarNames[field];
  const fromFlag = pickValue({ flag: flags[field] });
  const fallback = pickValue({
    env: envVarName === undefined ? undefined : io.env[envVarName],
    profile: saved[field]
  });

  if (fromFlag !== undefined) {
    return fromFlag.value;
  }

  if (!io.canPrompt) {
    if (fallback !== undefined) {
      return fallback.value;
    }

    throw missingValueError(steps, field);
  }

  const defaultAnswer = fallback?.value ?? question.onlyChoice;
  io.write(
    `${PLATFORM_NAMES[steps.platform]} ${field}s:\n${question.choices.map((choice) => `  ${choice}`).join('\n')}\n`
  );
  const answer = (
    await io.prompt(
      `${PLATFORM_NAMES[steps.platform]} ${field}${defaultAnswer === undefined ? '' : ` [${defaultAnswer}]`}: `
    )
  ).trim();
  const value = answer.length > 0 ? answer : defaultAnswer;

  if (value === undefined) {
    throw missingValueError(steps, field);
  }

  return value;
}

function missingValueError(
  steps: PlatformSetupSteps,
  field: keyof SetupValues
): CliError {
  const listCommand =
    field === 'location' ? undefined : steps.listCommands[field];

  return new CliError(`No ${PLATFORM_NAMES[steps.platform]} ${field} given.`, {
    code: 'MISSING_SETUP_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion:
      listCommand === undefined
        ? `Add ${FLAG_BY_VALUE[field]} Delhi or ${FLAG_BY_VALUE[field]} Chennai.`
        : `Add ${FLAG_BY_VALUE[field]} <id> (see \`${listCommand}\`).`
  });
}

function parseId(
  steps: PlatformSetupSteps,
  field: 'account' | 'project',
  raw: string
): number {
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  throw new CliError(
    `${PLATFORM_NAMES[steps.platform]} ${field} ID must be numeric.`,
    {
      code: 'INVALID_SETUP_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a numeric id from \`${steps.listCommands[field] ?? ''}\` with ${FLAG_BY_VALUE[field]}.`
    }
  );
}
