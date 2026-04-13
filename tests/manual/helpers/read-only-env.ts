import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';

import {
  normalizeOptionalEnvValue,
  readRequiredEnvValues,
  REQUIRED_MANUAL_BASE_ENV_VARS,
  toManualCliEnv
} from './manual-env.js';

export const OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS = {
  nodeId: 'E2ECTL_MANUAL_NODE_ID',
  reservedIp: 'E2ECTL_MANUAL_RESERVED_IP',
  securityGroupId: 'E2ECTL_MANUAL_SECURITY_GROUP_ID',
  sshKeyId: 'E2ECTL_MANUAL_SSH_KEY_ID',
  volumeId: 'E2ECTL_MANUAL_VOLUME_ID',
  vpcId: 'E2ECTL_MANUAL_VPC_ID'
} as const;

export interface ReadOnlyEnv {
  cliEnv: NodeJS.ProcessEnv;
  configProfile: {
    alias: string;
    apiKey: string;
    authToken: string;
    defaultLocation: string;
    defaultProjectId: string;
  };
  fixtures: {
    nodeId?: string;
    reservedIp?: string;
    securityGroupId?: string;
    sshKeyId?: string;
    volumeId?: string;
    vpcId?: string;
  };
}

export function readReadOnlyEnv(
  env: NodeJS.ProcessEnv = process.env
): ReadOnlyEnv {
  const requiredValues = readRequiredEnvValues({
    env,
    purpose: 'Manual read-only checks',
    requiredVars: REQUIRED_MANUAL_BASE_ENV_VARS
  });
  const nodeId = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.nodeId]
  );
  const reservedIp = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.reservedIp]
  );
  const securityGroupId = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.securityGroupId]
  );
  const sshKeyId = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.sshKeyId]
  );
  const volumeId = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.volumeId]
  );
  const vpcId = normalizeOptionalEnvValue(
    env[OPTIONAL_READ_ONLY_FIXTURE_ENV_VARS.vpcId]
  );
  const apiKey = requiredValues.E2E_API_KEY!;
  const authToken = requiredValues.E2E_AUTH_TOKEN!;
  const defaultLocation = requiredValues.E2E_LOCATION!;
  const defaultProjectId = requiredValues.E2E_PROJECT_ID!;

  return {
    cliEnv: toManualCliEnv(requiredValues, env),
    configProfile: {
      alias: 'manual-read-only',
      apiKey,
      authToken,
      defaultLocation,
      defaultProjectId
    },
    fixtures: {
      ...(nodeId === undefined ? {} : { nodeId }),
      ...(reservedIp === undefined ? {} : { reservedIp }),
      ...(securityGroupId === undefined ? {} : { securityGroupId }),
      ...(sshKeyId === undefined ? {} : { sshKeyId }),
      ...(volumeId === undefined ? {} : { volumeId }),
      ...(vpcId === undefined ? {} : { vpcId })
    }
  };
}

export function toConfigBackedReadOnlyCliEnv(
  readOnlyEnv: ReadOnlyEnv,
  homePath: string
): NodeJS.ProcessEnv {
  return {
    HOME: homePath,
    ...(readOnlyEnv.cliEnv[MYACCOUNT_BASE_URL_ENV_VAR] === undefined
      ? {}
      : {
          [MYACCOUNT_BASE_URL_ENV_VAR]:
            readOnlyEnv.cliEnv[MYACCOUNT_BASE_URL_ENV_VAR]
        })
  };
}
