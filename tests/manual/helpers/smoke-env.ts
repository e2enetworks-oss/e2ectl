import {
  normalizeOptionalEnvValue,
  readRequiredEnvValues,
  REQUIRED_MANUAL_BASE_ENV_VARS,
  toManualCliEnv
} from './manual-env.js';

const REQUIRED_SMOKE_ONLY_ENV_VARS = [
  'E2ECTL_SMOKE_NODE_PLAN',
  'E2ECTL_SMOKE_NODE_IMAGE',
  'E2ECTL_SMOKE_DNS_DOMAIN'
] as const;
const REQUIRED_SMOKE_ENV_VARS = [
  ...REQUIRED_MANUAL_BASE_ENV_VARS,
  ...REQUIRED_SMOKE_ONLY_ENV_VARS
] as const;

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
  const requiredValues = readRequiredEnvValues({
    env,
    purpose: 'Manual smoke',
    requiredVars: REQUIRED_SMOKE_ENV_VARS
  });

  const apiKey = requiredValues.E2E_API_KEY!;
  const authToken = requiredValues.E2E_AUTH_TOKEN!;
  const projectId = requiredValues.E2E_PROJECT_ID!;
  const location = requiredValues.E2E_LOCATION!;
  const nodePlan = requiredValues.E2ECTL_SMOKE_NODE_PLAN!;
  const nodeImage = requiredValues.E2ECTL_SMOKE_NODE_IMAGE!;
  const dnsDomain = requiredValues.E2ECTL_SMOKE_DNS_DOMAIN!;
  const manifestPath = normalizeOptionalEnvValue(env.E2ECTL_SMOKE_MANIFEST);
  const prefix = normalizePrefix(env.E2ECTL_SMOKE_PREFIX);
  const recordTtl = normalizeRecordTtl(env.E2ECTL_SMOKE_RECORD_TTL);

  return {
    apiKey,
    authToken,
    cliEnv: toManualCliEnv(requiredValues, env),
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

function normalizePrefix(value: string | undefined): string {
  const normalized = normalizeOptionalEnvValue(value) ?? 'release-smoke';
  const sanitized = normalized
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return sanitized.length === 0 ? 'release-smoke' : sanitized;
}

function normalizeRecordTtl(value: string | undefined): string {
  const normalized = normalizeOptionalEnvValue(value) ?? '300';

  if (!/^\d+$/.test(normalized) || Number.parseInt(normalized, 10) <= 0) {
    throw new Error(
      'E2ECTL_SMOKE_RECORD_TTL must be a positive integer when it is set.'
    );
  }

  return normalized;
}
