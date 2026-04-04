const REQUIRED_SMOKE_ENV_VARS = [
  'E2E_API_KEY',
  'E2E_AUTH_TOKEN',
  'E2E_PROJECT_ID',
  'E2E_LOCATION',
  'E2ECTL_SMOKE_NODE_PLAN',
  'E2ECTL_SMOKE_NODE_IMAGE',
  'E2ECTL_SMOKE_DNS_DOMAIN'
] as const;

const OPTIONAL_BASE_URL_ENV_VAR = 'E2ECTL_MYACCOUNT_BASE_URL';

export interface SmokeEnv {
  apiKey: string;
  authToken: string;
  cliEnv: NodeJS.ProcessEnv;
  dnsDomain: string;
  location: string;
  manifestPath?: string;
  nodeImage: string;
  nodePlan: string;
  prefix: string;
  projectId: string;
  recordTtl: string;
}

export function readSmokeEnv(env: NodeJS.ProcessEnv = process.env): SmokeEnv {
  const missing = REQUIRED_SMOKE_ENV_VARS.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Manual smoke requires ${REQUIRED_SMOKE_ENV_VARS.join(', ')}. Missing: ${missing.join(', ')}.`
    );
  }

  const apiKey = env.E2E_API_KEY!.trim();
  const authToken = env.E2E_AUTH_TOKEN!.trim();
  const projectId = env.E2E_PROJECT_ID!.trim();
  const location = env.E2E_LOCATION!.trim();
  const nodePlan = env.E2ECTL_SMOKE_NODE_PLAN!.trim();
  const nodeImage = env.E2ECTL_SMOKE_NODE_IMAGE!.trim();
  const dnsDomain = env.E2ECTL_SMOKE_DNS_DOMAIN!.trim();
  const manifestPath = normalizeOptional(env.E2ECTL_SMOKE_MANIFEST);
  const prefix = normalizePrefix(env.E2ECTL_SMOKE_PREFIX);
  const recordTtl = normalizeRecordTtl(env.E2ECTL_SMOKE_RECORD_TTL);
  const baseUrl = normalizeOptional(env[OPTIONAL_BASE_URL_ENV_VAR]);

  return {
    apiKey,
    authToken,
    cliEnv: {
      E2E_API_KEY: apiKey,
      E2E_AUTH_TOKEN: authToken,
      E2E_LOCATION: location,
      E2E_PROJECT_ID: projectId,
      ...(baseUrl === undefined
        ? {}
        : {
            [OPTIONAL_BASE_URL_ENV_VAR]: baseUrl
          })
    },
    dnsDomain,
    location,
    ...(manifestPath === undefined ? {} : { manifestPath }),
    nodeImage,
    nodePlan,
    prefix,
    projectId,
    recordTtl
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function normalizePrefix(value: string | undefined): string {
  const normalized = normalizeOptional(value) ?? 'release-smoke';
  const sanitized = normalized
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return sanitized.length === 0 ? 'release-smoke' : sanitized;
}

function normalizeRecordTtl(value: string | undefined): string {
  const normalized = normalizeOptional(value) ?? '300';

  if (!/^\d+$/.test(normalized) || Number.parseInt(normalized, 10) <= 0) {
    throw new Error(
      'E2ECTL_SMOKE_RECORD_TTL must be a positive integer when it is set.'
    );
  }

  return normalized;
}
