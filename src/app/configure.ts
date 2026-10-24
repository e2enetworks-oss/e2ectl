import { Command } from 'commander';

import {
  describePlatformSetup,
  findProfile,
  pickValue,
  type PlatformConfigureCommandResult,
  type PlatformSetupResult,
  type ProfileConfig,
  type SetupPlatform,
  type ValueSources
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import { configureMyAccount } from '../myaccount/project/index.js';
import { configureTir } from '../tir/project/index.js';
import { formatCliCommand } from './metadata.js';
import type { CliRuntime } from './runtime.js';

interface GlobalOptions {
  json?: boolean;
}

interface ConfigureOptions {
  account?: string;
  alias?: string;
  location?: string;
  platform?: string[];
  project?: string;
}

export interface ConfigureCommandResult {
  action: 'configure';
  alias: string;
  platforms: PlatformSetupResult[];
}

const PLATFORM_BY_NAME: Record<string, SetupPlatform> = {
  myaccount: 'myaccount',
  tir: 'tir'
};

// The interactive menu also takes its numbers.
const PLATFORM_BY_MENU_ANSWER: Record<string, SetupPlatform> = {
  ...PLATFORM_BY_NAME,
  '1': 'tir',
  '2': 'myaccount'
};

const NO_PLATFORM_MESSAGE = 'Choose at least one platform. TIR is recommended.';

// Each platform's own configure; e2ectl configure only chains them.
const CONFIGURE_BY_PLATFORM: Record<SetupPlatform, typeof configureTir> = {
  myaccount: configureMyAccount,
  tir: configureTir
};

export function buildConfigureCommand(runtime: CliRuntime): Command {
  return new Command('configure')
    .description(
      'Set up e2ectl: save your API key and token in a profile, then choose the TIR and/or MyAccount account, project and location. Asks in a terminal; in scripts give --platform and the values as flags, and the key and token in E2E_API_KEY and E2E_AUTH_TOKEN.'
    )
    .option(
      '--alias <alias>',
      'Profile to save into (default: the default profile, or "default").'
    )
    .option(
      '--platform <platform>',
      'tir or myaccount. Repeat for both. TIR is recommended.',
      (value: string, previous: string[] = []) => [...previous, value]
    )
    .option('--account <accountId>', 'TIR account id (one platform only).')
    .option('--project <projectId>', 'Project id (one platform only).')
    .option('--location <location>', 'Delhi or Chennai (one platform only).')
    .action(async (options: ConfigureOptions, commandInstance: Command) => {
      const json =
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false;
      const result = await runConfigure(
        runtime,
        options,
        runtime.isInteractive && !json
      );
      runtime.stdout.write(renderConfigureResult(result, json));
    });
}

export async function runConfigure(
  runtime: CliRuntime,
  options: ConfigureOptions,
  canPrompt: boolean
): Promise<ConfigureCommandResult> {
  // Flag mistakes fail before anything is saved.
  const requested = parsePlatforms(options.platform ?? []);
  if (requested.length === 0 && !canPrompt) {
    throw new CliError(
      'Choose at least one platform with --platform tir or --platform myaccount (TIR is recommended).',
      { code: 'MISSING_PLATFORM', exitCode: EXIT_CODES.usage }
    );
  }
  if (requested.length > 0) {
    assertValuesFitPlatforms(options, requested);
  }

  const alias = await saveKeyAndToken(runtime, options.alias, canPrompt);
  const platforms =
    requested.length > 0 ? requested : await askPlatforms(runtime);
  assertValuesFitPlatforms(options, platforms);

  const results: PlatformSetupResult[] = [];
  for (const platform of platforms) {
    const configured = await CONFIGURE_BY_PLATFORM[platform](
      runtime,
      {
        alias,
        account: options.account,
        location: options.location,
        project: options.project
      },
      canPrompt
    );
    results.push(withoutCommandFields(configured));
  }

  return { action: 'configure', alias, platforms: results };
}

function renderConfigureResult(
  result: ConfigureCommandResult,
  json: boolean
): string {
  if (json) {
    return `${stableStringify(result as unknown as JsonValue)}\n`;
  }

  return `${[
    `Saved the key and token in profile "${result.alias}".`,
    ...result.platforms.map((platform) =>
      describePlatformSetup(result.alias, platform)
    )
  ].join('\n')}\n`;
}

// Key and token: in a terminal they are asked for (hidden); otherwise they
// come from E2E_API_KEY and E2E_AUTH_TOKEN or the saved profile, in the
// usual value order (a profile named with --alias beats the environment).
// They are never taken as flags, so they stay out of shell history. The
// token is checked against the API before anything is saved.
async function saveKeyAndToken(
  runtime: CliRuntime,
  requestedAlias: string | undefined,
  canPrompt: boolean
): Promise<string> {
  const config = await runtime.store.read();
  const chosenAlias = normalizeAlias(requestedAlias);
  const alias = chosenAlias ?? config.default ?? 'default';
  const saved = findProfile(config, alias);
  // --alias picks the saved key over the environment, as on every command.
  const chosenByFlag = chosenAlias !== undefined;
  const fromSaved = (field: 'api_key' | 'auth_token'): ValueSources => ({
    flag: chosenByFlag ? saved?.[field] : undefined,
    profile: chosenByFlag ? undefined : saved?.[field]
  });
  const apiKey = await readSecret(runtime, canPrompt, 'API key', {
    env: process.env.E2E_API_KEY,
    ...fromSaved('api_key')
  });
  const authToken = await readSecret(runtime, canPrompt, 'Auth token', {
    env: process.env.E2E_AUTH_TOKEN,
    ...fromSaved('auth_token')
  });

  const check = await runtime.credentialValidator.validate({
    api_key: apiKey,
    auth_token: authToken
  });
  if (!check.valid) {
    throw new CliError('The API key and token were not accepted.', {
      code: 'INVALID_CREDENTIALS',
      details: check.message === undefined ? [] : [check.message],
      exitCode: EXIT_CODES.auth,
      suggestion:
        'Create a new key and token in MyAccount (API & IAM), then run `e2ectl configure` again.'
    });
  }

  const keys: ProfileConfig = { api_key: apiKey, auth_token: authToken };
  if (saved === undefined) {
    await runtime.store.upsertProfile(alias, keys);
  } else {
    await runtime.store.updateProfile(alias, keys);
  }

  return alias;
}

// Names every object already has (like "constructor") cannot be saved as
// profiles safely.
function normalizeAlias(value: string | undefined): string | undefined {
  const alias = value?.trim();
  if (alias === undefined || (alias !== '' && !(alias in Object.prototype))) {
    return alias;
  }

  throw new CliError(`"${value ?? ''}" cannot be a profile name.`, {
    code: 'INVALID_ALIAS',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass a profile name such as work with --alias, or leave it out.'
  });
}

async function readSecret(
  runtime: CliRuntime,
  canPrompt: boolean,
  label: 'API key' | 'Auth token',
  sources: ValueSources
): Promise<string> {
  const fallback = pickValue(sources)?.value;

  if (canPrompt) {
    const answer = (
      await runtime.promptSecret(
        `${label}${fallback === undefined ? '' : ' (press Enter to keep the current one)'}: `
      )
    ).trim();
    if (answer.length > 0) {
      return answer;
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new CliError(`No ${label.toLowerCase()} given.`, {
    code: 'MISSING_CREDENTIALS',
    exitCode: EXIT_CODES.auth,
    suggestion:
      'Set E2E_API_KEY and E2E_AUTH_TOKEN, or run `e2ectl configure` in a terminal. Keys are never passed as flags.'
  });
}

function parsePlatforms(values: string[]): SetupPlatform[] {
  const platforms = new Set<SetupPlatform>();

  for (const value of values) {
    const platform = lookupPlatform(PLATFORM_BY_NAME, value);
    if (platform === undefined) {
      throw new CliError(`Unknown platform "${value}".`, {
        code: 'INVALID_PLATFORM',
        exitCode: EXIT_CODES.usage,
        // The menu's numbers only work in the interactive menu.
        suggestion:
          '--platform takes a name: --platform tir or --platform myaccount (TIR is recommended).'
      });
    }
    platforms.add(platform);
  }

  return [...platforms];
}

// A numbered choice with TIR picked by default; choosing none asks again.
async function askPlatforms(runtime: CliRuntime): Promise<SetupPlatform[]> {
  for (;;) {
    runtime.stdout.write(
      'Which platforms do you use?\n  1) TIR (recommended)\n  2) MyAccount\n'
    );
    const answer = await runtime.prompt('Platforms, separated by commas [1]: ');
    const platforms =
      answer.trim().length === 0
        ? ['tir' as const]
        : readPlatformAnswer(answer);

    if (platforms.length > 0) {
      return platforms;
    }

    runtime.stdout.write(`${NO_PLATFORM_MESSAGE}\n`);
  }
}

function readPlatformAnswer(answer: string): SetupPlatform[] {
  return [
    ...new Set(
      answer
        .split(',')
        .map((part) => lookupPlatform(PLATFORM_BY_MENU_ANSWER, part))
        .filter((platform): platform is SetupPlatform => platform !== undefined)
    )
  ];
}

// Own keys only, so a typed "constructor" or "toString" is not a platform.
function lookupPlatform(
  table: Record<string, SetupPlatform>,
  text: string
): SetupPlatform | undefined {
  const key = text.trim().toLowerCase();
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

// --account, --project and --location hold one platform's values; TIR and
// MyAccount project ids are different things.
function assertValuesFitPlatforms(
  options: ConfigureOptions,
  platforms: SetupPlatform[]
): void {
  const given = (['account', 'project', 'location'] as const).filter(
    (field) => options[field] !== undefined
  );

  if (given.length > 0 && platforms.length > 1) {
    throw new CliError(
      `--${given.join(', --')} can only be used with one platform.`,
      {
        code: 'AMBIGUOUS_SETUP_VALUES',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run \`${formatCliCommand('tir configure')}\` and \`${formatCliCommand('myaccount configure')}\` separately, or set E2E_TIR_PROJECT_ID/E2E_TIR_LOCATION and E2E_PROJECT_ID/E2E_LOCATION.`
      }
    );
  }

  if (options.account !== undefined && !platforms.includes('tir')) {
    throw new CliError('--account is only for TIR.', {
      code: 'AMBIGUOUS_SETUP_VALUES',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Remove --account, or add --platform tir.'
    });
  }
}

function withoutCommandFields(
  result: PlatformConfigureCommandResult
): PlatformSetupResult {
  return {
    account: result.account,
    location: result.location,
    platform: result.platform,
    project: result.project
  };
}
