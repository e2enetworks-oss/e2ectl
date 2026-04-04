import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';

export const REQUIRED_MANUAL_BASE_ENV_VARS = [
  'E2E_API_KEY',
  'E2E_AUTH_TOKEN',
  'E2E_PROJECT_ID',
  'E2E_LOCATION'
] as const;

export function readRequiredEnvValues(options: {
  env?: NodeJS.ProcessEnv;
  purpose: string;
  requiredVars: readonly string[];
}): Record<string, string> {
  const env = options.env ?? process.env;
  const missing = options.requiredVars.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `${options.purpose} requires ${options.requiredVars.join(', ')}. Missing: ${missing.join(', ')}.`
    );
  }

  return Object.fromEntries(
    options.requiredVars.map((name) => [name, env[name]!.trim()])
  );
}

export function normalizeOptionalEnvValue(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

export function toManualCliEnv(
  requiredValues: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const baseUrl = normalizeOptionalEnvValue(env[MYACCOUNT_BASE_URL_ENV_VAR]);

  return {
    E2E_API_KEY: requiredValues.E2E_API_KEY,
    E2E_AUTH_TOKEN: requiredValues.E2E_AUTH_TOKEN,
    E2E_LOCATION: requiredValues.E2E_LOCATION,
    E2E_PROJECT_ID: requiredValues.E2E_PROJECT_ID,
    ...(baseUrl === undefined
      ? {}
      : {
          [MYACCOUNT_BASE_URL_ENV_VAR]: baseUrl
        })
  };
}
