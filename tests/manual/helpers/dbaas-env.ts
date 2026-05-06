import {
  readRequiredEnvValues,
  REQUIRED_MANUAL_BASE_ENV_VARS,
  toManualCliEnv
} from './manual-env.js';

export interface DbaasManualEnv {
  apiKey: string;
  authToken: string;
  cliEnv: NodeJS.ProcessEnv;
  location: string;
  prefix: string;
  projectId: string;
}

export function readDbaasManualEnv(
  env: NodeJS.ProcessEnv = process.env
): DbaasManualEnv {
  const requiredValues = readRequiredEnvValues({
    env,
    purpose: 'Manual DBaaS destructive',
    requiredVars: REQUIRED_MANUAL_BASE_ENV_VARS
  });

  const apiKey = requiredValues.E2E_API_KEY!;
  const authToken = requiredValues.E2E_AUTH_TOKEN!;
  const projectId = requiredValues.E2E_PROJECT_ID!;
  const location = requiredValues.E2E_LOCATION!;
  const prefix = normalizePrefix(env.E2ECTL_DBAAS_PREFIX);

  return {
    apiKey,
    authToken,
    cliEnv: toManualCliEnv(requiredValues, env),
    location,
    prefix,
    projectId
  };
}

function normalizePrefix(value: string | undefined): string {
  const normalized = (value ?? 'manual-dbaas').trim();

  if (normalized.length === 0) {
    return 'manual-dbaas';
  }

  return normalized;
}
