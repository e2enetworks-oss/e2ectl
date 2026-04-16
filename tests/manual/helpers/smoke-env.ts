import {
  normalizeOptionalEnvValue,
  readRequiredEnvValues,
  REQUIRED_MANUAL_BASE_ENV_VARS,
  toManualCliEnv
} from './manual-env.js';

const REQUIRED_SMOKE_ONLY_ENV_VARS = [
  'E2ECTL_SMOKE_NODE_PLAN',
  'E2ECTL_SMOKE_NODE_IMAGE',
  'E2ECTL_SMOKE_UPGRADE_PLAN',
  'E2ECTL_SMOKE_UPGRADE_IMAGE'
] as const;
const REQUIRED_SMOKE_ENV_VARS = [
  ...REQUIRED_MANUAL_BASE_ENV_VARS,
  ...REQUIRED_SMOKE_ONLY_ENV_VARS
] as const;

export interface SmokeEnv {
  apiKey: string;
  authToken: string;
  cliEnv: NodeJS.ProcessEnv;
  location: string;
  manifestPath?: string;
  nodeImage: string;
  nodePlan: string;
  prefix: string;
  projectId: string;
  upgradeImage: string;
  upgradePlan: string;
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
  const upgradePlan = requiredValues.E2ECTL_SMOKE_UPGRADE_PLAN!;
  const upgradeImage = requiredValues.E2ECTL_SMOKE_UPGRADE_IMAGE!;
  const manifestPath = normalizeOptionalEnvValue(env.E2ECTL_SMOKE_MANIFEST);
  const prefix = normalizePrefix(env.E2ECTL_SMOKE_PREFIX);

  validateUpgradeTarget({
    nodeImage,
    nodePlan,
    upgradeImage,
    upgradePlan
  });

  return {
    apiKey,
    authToken,
    cliEnv: toManualCliEnv(requiredValues, env),
    location,
    ...(manifestPath === undefined ? {} : { manifestPath }),
    nodeImage,
    nodePlan,
    prefix,
    projectId,
    upgradeImage,
    upgradePlan
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

function validateUpgradeTarget(options: {
  nodeImage: string;
  nodePlan: string;
  upgradeImage: string;
  upgradePlan: string;
}): void {
  if (
    options.nodePlan === options.upgradePlan &&
    options.nodeImage === options.upgradeImage
  ) {
    throw new Error(
      'Manual smoke upgrade target must differ from the create target in at least one of plan or image.'
    );
  }
}
