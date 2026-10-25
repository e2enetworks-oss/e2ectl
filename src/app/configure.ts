import { Command, Option } from 'commander';

import {
  describePlatformSetup,
  findProfile,
  pickKeyAndToken,
  type PickedValue,
  type PlatformConfigureOutcome,
  type PlatformConfigureRequest,
  type PlatformSetupResult,
  type ProfileConfig,
  type SetupPlatform,
  type SetupValues
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
  alias?: string;
  myaccountLocation?: string;
  myaccountProjectId?: string;
  platform?: SetupPlatform[];
  tirAccountId?: string;
  tirLocation?: string;
  tirProjectId?: string;
}

export interface ConfigureCommandResult {
  action: 'configure';
  alias: string;
  platforms: PlatformSetupResult[];
}

// TIR first: it is the recommended platform and the menu's default.
const PLATFORMS: readonly SetupPlatform[] = ['tir', 'myaccount'];

const MENU_ANSWERS: Record<string, SetupPlatform> = {
  '1': 'tir',
  '2': 'myaccount',
  myaccount: 'myaccount',
  tir: 'tir'
};

// Each platform's own configure; e2ectl configure only chains them.
const CONFIGURE_BY_PLATFORM: Record<
  SetupPlatform,
  (
    runtime: CliRuntime,
    request: PlatformConfigureRequest
  ) => Promise<PlatformConfigureOutcome>
> = {
  myaccount: configureMyAccount,
  tir: configureTir
};

export function buildConfigureCommand(runtime: CliRuntime): Command {
  return new Command('configure')
    .description(
      'Set up e2ectl: save your API key and token in a profile, then choose the account, project and location for TIR, MyAccount or both. Asks in a terminal. In scripts, give the key and token in E2E_API_KEY and E2E_AUTH_TOKEN and the values as flags; giving the flags of a platform chooses it.'
    )
    .option(
      '--alias <alias>',
      'Profile to save into (default: the default profile, or "default").'
    )
    .addOption(
      new Option(
        '--platform <platform...>',
        'Platforms to set up. TIR is recommended.'
      ).choices(PLATFORMS)
    )
    .option('--tir-account-id <id>', 'TIR account id.')
    .option('--tir-project-id <id>', 'TIR project id.')
    .option('--tir-location <location>', 'TIR location: Delhi or Chennai.')
    .option('--myaccount-project-id <id>', 'MyAccount project id.')
    .option(
      '--myaccount-location <location>',
      'MyAccount location: Delhi or Chennai.'
    )
    .addHelpText(
      'after',
      `\nExamples:\n  ${formatCliCommand('configure')}\n  E2E_API_KEY=... E2E_AUTH_TOKEN=... ${formatCliCommand('configure --tir-account-id 12 --tir-project-id 34 --tir-location Delhi --myaccount-project-id 46 --myaccount-location Chennai')}\n`
    )
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
  const valuesByPlatform: Record<SetupPlatform, SetupValues> = {
    myaccount: {
      location: options.myaccountLocation,
      project: options.myaccountProjectId
    },
    tir: {
      account: options.tirAccountId,
      location: options.tirLocation,
      project: options.tirProjectId
    }
  };
  const requested = PLATFORMS.filter(
    (platform) =>
      (options.platform ?? []).includes(platform) ||
      Object.values(valuesByPlatform[platform]).some(
        (value) => value !== undefined
      )
  );
  if (requested.length === 0 && !canPrompt) {
    throw new CliError('Choose at least one platform.', {
      code: 'MISSING_PLATFORM',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Add --platform tir or --platform myaccount (TIR is recommended), or give the values of a platform, such as --tir-project-id.'
    });
  }

  const alias = await saveKeyAndToken(runtime, options.alias, canPrompt);
  const platforms =
    requested.length > 0 ? requested : await askPlatforms(runtime);

  const results: PlatformSetupResult[] = [];
  for (const platform of platforms) {
    const outcome = await CONFIGURE_BY_PLATFORM[platform](runtime, {
      alias,
      canPrompt,
      flagPrefix: `${platform}-`,
      values: valuesByPlatform[platform]
    });
    results.push(outcome.setup);
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
// same order as every command (a profile named with --alias beats the
// environment). They are never taken as flags, so they stay out of shell
// history. The token is checked against the API before anything is saved.
async function saveKeyAndToken(
  runtime: CliRuntime,
  requestedAlias: string | undefined,
  canPrompt: boolean
): Promise<string> {
  const config = await runtime.store.read();
  const chosenAlias = normalizeAlias(requestedAlias);
  const alias = chosenAlias ?? config.default ?? 'default';
  const saved = findProfile(config, alias);
  const fallback = pickKeyAndToken(
    saved,
    chosenAlias !== undefined,
    process.env
  );
  const apiKey = await readSecret(runtime, canPrompt, 'API key', {
    envVar: 'E2E_API_KEY',
    picked: fallback.api_key
  });
  const authToken = await readSecret(runtime, canPrompt, 'Auth token', {
    envVar: 'E2E_AUTH_TOKEN',
    picked: fallback.auth_token
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

// In a terminal, pressing Enter keeps the value the prompt names: the one
// from the environment variable or the saved one.
async function readSecret(
  runtime: CliRuntime,
  canPrompt: boolean,
  label: 'API key' | 'Auth token',
  fallback: { envVar: string; picked: PickedValue | undefined }
): Promise<string> {
  const { envVar, picked } = fallback;

  if (canPrompt) {
    const keep =
      picked === undefined
        ? ''
        : picked.origin === 'env'
          ? ` (press Enter to use ${envVar})`
          : ' (press Enter to keep the saved one)';
    const answer = (await runtime.promptSecret(`${label}${keep}: `)).trim();
    if (answer.length > 0) {
      return answer;
    }
  }

  if (picked !== undefined) {
    return picked.value;
  }

  throw new CliError(`No ${label.toLowerCase()} given.`, {
    code: 'MISSING_CREDENTIALS',
    exitCode: EXIT_CODES.auth,
    suggestion:
      'Set E2E_API_KEY and E2E_AUTH_TOKEN, or run `e2ectl configure` in a terminal. Keys are never passed as flags.'
  });
}

// A numbered choice with TIR picked by default. Choosing none, or typing
// something the menu does not offer, asks again.
async function askPlatforms(runtime: CliRuntime): Promise<SetupPlatform[]> {
  for (;;) {
    runtime.stdout.write(
      'Which platforms do you use?\n  1) TIR (recommended)\n  2) MyAccount\n'
    );
    const answer = await runtime.prompt('Platforms, separated by commas [1]: ');
    const parts = answer
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);
    if (parts.length === 0) {
      return ['tir'];
    }

    const unknown = parts.filter((part) => !Object.hasOwn(MENU_ANSWERS, part));
    if (unknown.length === 0) {
      return PLATFORMS.filter((platform) =>
        parts.some((part) => MENU_ANSWERS[part] === platform)
      );
    }

    runtime.stdout.write(
      `Not a choice: ${unknown.join(', ')}. Choose at least one platform. TIR is recommended.\n`
    );
  }
}
