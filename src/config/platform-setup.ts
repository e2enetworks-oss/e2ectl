import { CliError, EXIT_CODES } from '../core/errors.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import { normalizeRequiredNumericId } from '../core/normalize.js';
import { findLocation, normalizeLocation } from './checks.js';
import { findProfile } from './store.js';
import type { ConfigFile, ProfileConfig } from './types.js';
import { VALID_LOCATIONS } from './types.js';
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

// One configure run: the profile named with --alias (or the default one),
// the values given as flags, and whether questions can be asked.
export interface PlatformConfigureRequest {
  alias?: string | undefined;
  // False without a terminal or with --json: then a missing value is an
  // error naming the flag to add.
  canPrompt: boolean;
  // How the flags are spelled where this runs: '' for tir configure and
  // myaccount configure, 'tir-' or 'myaccount-' for e2ectl configure.
  flagPrefix: string;
  values: SetupValues;
}

// The parts of the CLI the setup uses.
export interface PlatformSetupTerminal {
  prompt(message: string): Promise<string>;
  stdout: { write(text: string): unknown };
  store: {
    read(): Promise<ConfigFile>;
    updateProfile(
      alias: string,
      patch: Partial<ProfileConfig>
    ): Promise<ConfigFile>;
  };
}

// Builds the platform's steps with the key later commands use: the --alias
// profile, otherwise E2E_API_KEY/E2E_AUTH_TOKEN, otherwise the default
// profile.
export type CreateSetupSteps = (keySource: {
  alias?: string;
}) => Promise<PlatformSetupSteps>;

export interface PlatformSetupResult {
  account: { email: string; id: number; name: string } | null;
  location: string;
  platform: SetupPlatform;
  project: SetupProject;
}

export interface PlatformConfigureOutcome {
  alias: string;
  setup: PlatformSetupResult;
}

interface SetupRun {
  canPrompt: boolean;
  flagPrefix: string;
  steps: PlatformSetupSteps;
  terminal: PlatformSetupTerminal;
}

type SetupField = keyof SetupValues;

const PLATFORM_NAMES: Record<SetupPlatform, string> = {
  myaccount: 'MyAccount',
  tir: 'TIR'
};

const FLAG_NAMES: Record<SetupField, string> = {
  account: 'account-id',
  location: 'location',
  project: 'project-id'
};

export function platformName(platform: SetupPlatform): string {
  return PLATFORM_NAMES[platform];
}

// The --json shape of tir configure and myaccount configure.
export function renderPlatformSetupResult(
  outcome: PlatformConfigureOutcome,
  json: boolean
): string {
  return json
    ? `${stableStringify({ action: 'configure', alias: outcome.alias, ...outcome.setup } as unknown as JsonValue)}\n`
    : `${describePlatformSetup(outcome.alias, outcome.setup)}\n`;
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

  return `${platformName(result.platform)} context saved for profile "${alias}": ${parts.join(', ')}.`;
}

// Asks for (or reads) the account, project and location, checks each one
// against the platform, and saves them on the profile. Values that can be
// checked without the API are checked first, and nothing is saved unless
// every check passes.
export async function configurePlatform(
  request: PlatformConfigureRequest,
  terminal: PlatformSetupTerminal,
  createSteps: CreateSetupSteps
): Promise<PlatformConfigureOutcome> {
  const { alias, profile } = await findSetupProfile(
    terminal.store,
    request.alias
  );
  const steps = await createSteps(
    request.alias === undefined ? {} : { alias: request.alias }
  );
  const run: SetupRun = {
    canPrompt: request.canPrompt,
    flagPrefix: request.flagPrefix,
    steps,
    terminal
  };
  const saved = steps.readSaved(profile);
  const flags = request.values;
  const known = knownValues(steps, saved);
  const flaggedAccount = pickValue({ flag: flags.account })?.value;
  checkWithoutApi(
    run,
    flags,
    withoutStaleProject(known, saved, flaggedAccount ?? known.account)
  );

  const account = await chooseAccount(run, flags, known);
  const project = await chooseProject(
    run,
    account?.id,
    flags,
    withoutStaleProject(known, saved, account?.id.toString())
  );
  const location = await chooseLocation(run, flags, known);

  await terminal.store.updateProfile(
    alias,
    steps.toProfilePatch({
      ...(account === undefined ? {} : { accountId: account.id }),
      location,
      projectId: project.id
    })
  );

  return {
    alias,
    setup: {
      account:
        account === undefined
          ? null
          : { email: account.email, id: account.id, name: account.name },
      location,
      platform: steps.platform,
      project
    }
  };
}

// The profile a configure command saves into: the --alias one, or the
// default profile.
async function findSetupProfile(
  store: PlatformSetupTerminal['store'],
  requested: string | undefined
): Promise<{ alias: string; profile: ProfileConfig }> {
  const config = await store.read();
  const alias = requested ?? config.default;
  const profile = alias === undefined ? undefined : findProfile(config, alias);

  if (alias !== undefined && profile !== undefined) {
    return { alias, profile };
  }

  throw new CliError(
    alias === undefined
      ? 'There is no saved profile to keep this setting in.'
      : `Profile "${alias}" was not found.`,
    {
      code: 'PROFILE_NOT_FOUND',
      exitCode: EXIT_CODES.config,
      suggestion:
        'Run `e2ectl configure` to save a key and token in a profile first.'
    }
  );
}

// Each value from its environment variable, else the saved profile.
function knownValues(
  steps: PlatformSetupSteps,
  saved: SetupValues
): SetupValues {
  const fallback = (field: SetupField): string | undefined => {
    const envVarName = steps.envVarNames[field];
    return pickValue({
      env: envVarName === undefined ? undefined : process.env[envVarName],
      profile: saved[field]
    })?.value;
  };

  return {
    account: steps.listAccounts === undefined ? undefined : fallback('account'),
    location: fallback('location'),
    project: fallback('project')
  };
}

// A saved project belongs to the saved account, so it is not offered once
// another account is chosen.
function withoutStaleProject(
  known: SetupValues,
  saved: SetupValues,
  accountId: string | undefined
): SetupValues {
  const stale =
    accountId !== undefined &&
    accountId !== saved.account &&
    known.project === saved.project;

  return stale ? { ...known, project: undefined } : known;
}

// Without a terminal, every missing value is reported at once. Ids and the
// location are checked before any API call.
function checkWithoutApi(
  run: SetupRun,
  flags: SetupValues,
  known: SetupValues
): void {
  const fields: SetupField[] =
    run.steps.listAccounts === undefined
      ? ['project', 'location']
      : ['account', 'project', 'location'];
  const value = (field: SetupField): string | undefined =>
    pickValue({ flag: flags[field] })?.value ?? known[field];

  const missing = fields.filter((field) => value(field) === undefined);
  if (!run.canPrompt && missing.length > 0) {
    throw missingValuesError(run, missing);
  }

  for (const field of fields) {
    const given = value(field);
    if (given !== undefined) {
      checkFormat(run, field, given);
    }
  }
}

function checkFormat(run: SetupRun, field: SetupField, value: string): void {
  if (field === 'location') {
    normalizeLocation(value);
    return;
  }

  normalizeRequiredNumericId(
    value,
    `${platformName(run.steps.platform)} ${field} ID`,
    flagName(run, field)
  );
}

async function chooseAccount(
  run: SetupRun,
  flags: SetupValues,
  known: SetupValues
): Promise<SetupAccount | undefined> {
  const { steps } = run;
  if (steps.listAccounts === undefined) {
    return undefined;
  }

  const name = platformName(steps.platform);
  const accounts = await steps.listAccounts();
  const usable = accounts.filter((account) => account.usable);
  const raw = await readValue(run, 'account', flags, known, {
    choices: accounts.map(
      (account) =>
        `${account.id}  ${account.email || account.name}${account.usable ? '' : `  (${name} is off)`}`
    ),
    onlyChoice: usable.length === 1 ? String(usable[0]?.id) : undefined
  });
  const id = normalizeRequiredNumericId(
    raw,
    `${name} account ID`,
    flagName(run, 'account')
  );
  const found = accounts.find((account) => account.id === id);

  if (found === undefined) {
    throw new CliError(`${name} account ${id} is not one your key can use.`, {
      code: 'SETUP_ACCOUNT_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run \`${steps.listCommands.account ?? ''}\` and pass a listed id with ${flagName(run, 'account')}.`
    });
  }

  if (!found.usable) {
    throw new CliError(`${name} is not turned on for account ${id}.`, {
      code: 'SETUP_ACCOUNT_DISABLED',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pick another account from \`${steps.listCommands.account ?? ''}\`, or ask its owner to turn ${name} on.`
    });
  }

  return found;
}

async function chooseProject(
  run: SetupRun,
  accountId: number | undefined,
  flags: SetupValues,
  known: SetupValues
): Promise<SetupProject> {
  const { steps } = run;
  const name = platformName(steps.platform);
  const where = accountId === undefined ? '' : ` in account ${accountId}`;
  const projects = await steps.listProjects(accountId);
  if (projects.length === 0) {
    throw new CliError(`There are no ${name} projects${where}.`, {
      code: 'SETUP_NO_PROJECTS',
      exitCode: EXIT_CODES.usage,
      suggestion: `Create a project on ${name} first, then run configure again.`
    });
  }

  const raw = await readValue(run, 'project', flags, known, {
    choices: projects.map((project) => `${project.id}  ${project.name}`),
    onlyChoice: projects.length === 1 ? String(projects[0]?.id) : undefined
  });
  const id = normalizeRequiredNumericId(
    raw,
    `${name} project ID`,
    flagName(run, 'project')
  );
  const found = projects.find((project) => project.id === id);

  if (found === undefined) {
    throw new CliError(`${name} project ${id} was not found${where}.`, {
      code: 'SETUP_PROJECT_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run \`${steps.listCommands.project}\` and pass a listed id with ${flagName(run, 'project')}.`
    });
  }

  // Only the id and name, so every platform reports the same shape.
  return { id: found.id, name: found.name };
}

async function chooseLocation(
  run: SetupRun,
  flags: SetupValues,
  known: SetupValues
): Promise<string> {
  const raw = await readValue(run, 'location', flags, known, {
    choices: [...VALID_LOCATIONS],
    onlyChoice: undefined
  });

  return findLocation(raw) ?? normalizeLocation(raw);
}

// A flag is used as it is. Otherwise the environment variable or the saved
// value is used; in a terminal it is offered as the default answer instead,
// so running configure again can change it.
async function readValue(
  run: SetupRun,
  field: SetupField,
  flags: SetupValues,
  known: SetupValues,
  question: { choices: string[]; onlyChoice: string | undefined }
): Promise<string> {
  const fromFlag = pickValue({ flag: flags[field] })?.value;
  if (fromFlag !== undefined) {
    return fromFlag;
  }

  const fallback = known[field];
  if (!run.canPrompt) {
    // checkWithoutApi has already reported missing values.
    return fallback ?? '';
  }

  const name = platformName(run.steps.platform);
  const defaultAnswer = fallback ?? question.onlyChoice;
  run.terminal.stdout.write(
    `${name} ${field}s:\n${question.choices.map((choice) => `  ${choice}`).join('\n')}\n`
  );
  const answer = (
    await run.terminal.prompt(
      `${name} ${field}${defaultAnswer === undefined ? '' : ` [${defaultAnswer}]`}: `
    )
  ).trim();
  const value = answer.length > 0 ? answer : defaultAnswer;

  if (value === undefined) {
    throw missingValuesError(run, [field]);
  }

  return value;
}

function missingValuesError(run: SetupRun, fields: SetupField[]): CliError {
  const name = platformName(run.steps.platform);
  const hints = fields.map((field) => {
    const flag = flagName(run, field);
    const listCommand =
      field === 'location' ? undefined : run.steps.listCommands[field];
    return listCommand === undefined
      ? `${flag} Delhi|Chennai`
      : `${flag} <id> (see \`${listCommand}\`)`;
  });

  return new CliError(`No ${name} ${joinWords(fields)} given.`, {
    code: 'MISSING_SETUP_VALUE',
    details: hints.map((hint) => `Add ${hint}`),
    exitCode: EXIT_CODES.usage,
    suggestion: `Add ${hints.join(', ')}.`
  });
}

function flagName(run: SetupRun, field: SetupField): string {
  return `--${run.flagPrefix}${FLAG_NAMES[field]}`;
}

// ['a', 'b', 'c'] -> "a, b and c".
function joinWords(words: string[]): string {
  return words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}
