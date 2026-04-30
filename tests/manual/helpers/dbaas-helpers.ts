// Shared utilities for DBaaS manual live tests

export interface DbaasListTypesJson {
  action: 'list-types';
  items: Array<{
    type: string;
    version: string;
  }>;
}

export interface DbaasPlansJson {
  action: 'plans';
  items: Array<{
    name: string;
    template_id: number;
    type: string;
    version: string;
  }>;
}

export interface DbaasListJson {
  action: 'list';
  items: Array<{
    id: number;
    name: string;
    type: string;
    version: string;
    status: string;
  }>;
}

export interface DbaasGetJson {
  action: 'get';
  dbaas: {
    id: number | string;
    name: string;
    type: string;
    version: string;
    username: string;
    database_name: string;
    status: string;
    connection_endpoint: string | null;
    connection_port: string | null;
    connection_string: string | null;
  };
}

export interface DbaasCreateJson {
  action: 'create';
  dbaas: {
    id: number;
    name: string;
    type: string;
    version: string;
    username: string;
    database_name: string;
  };
}

export interface DbaasResetPasswordJson {
  action: 'reset-password';
  dbaas: {
    id: number;
    name: string;
    type: string;
    version: string;
  };
}

export interface DbaasDeleteJson {
  action: 'delete';
  dbaas_id: number;
  cancelled: boolean;
}

export interface DbaasWhitelistListJson {
  action: 'whitelist-list';
  items: Array<{
    ip: string;
  }>;
}

export interface DbaasWhitelistAddJson {
  action: 'whitelist-add';
  dbaas_id: number;
}

export interface DbaasWhitelistRemoveJson {
  action: 'whitelist-remove';
  dbaas_id: number;
}

export function toDbaasTypeFlag(type: string): string {
  switch (type) {
    case 'MariaDB':
      return 'maria';
    case 'MySQL':
      return 'sql';
    case 'PostgreSQL':
      return 'postgres';
    default:
      throw new Error(`Unsupported DBaaS type in live catalog: ${type}`);
  }
}

export interface DbaasSmokeManifest {
  dbaas_id: number | null;
  dbaas_name: string | null;
  database_name: string | null;
  whitelisted_ip: string | null;
  dbaas_deleted: boolean;
  vpc_id: number | null;
  vpc_attached: boolean;
  public_ip_attached: boolean;
  vpc_deleted: boolean;
}

export function createEmptyDbaasManifest(): DbaasSmokeManifest {
  return {
    dbaas_id: null,
    dbaas_name: null,
    database_name: null,
    whitelisted_ip: null,
    dbaas_deleted: false,
    vpc_id: null,
    vpc_attached: false,
    public_ip_attached: false,
    vpc_deleted: false
  };
}

export async function waitForDbaasStatus(
  runCommand: (args: string[]) => Promise<DbaasGetJson>,
  dbaasId: number,
  targetStatus: string,
  timeoutMs: number = 20 * 60 * 1000 // 20 minutes
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const normalizedTargetStatus = normalizeLifecycleStatus(targetStatus);

  while (Date.now() <= deadline) {
    try {
      const result = await runCommand(['dbaas', 'get', String(dbaasId)]);

      if (
        normalizeLifecycleStatus(result.dbaas.status) ===
        normalizedTargetStatus
      ) {
        return;
      }
    } catch {
      // Ignore errors and retry
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 15_000)); // Poll every 15 seconds
    }
  }

  throw new Error(
    `Timed out waiting for DBaaS ${dbaasId} to become ${targetStatus}`
  );
}

function normalizeLifecycleStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
