import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type {
  DbaasClusterDetail,
  DbaasClusterSummary,
  DbaasDetailItem,
  DbaasListItem,
  DbaasListTypeItem,
  DbaasPlanCatalog,
  DbaasPlanInfo,
  DbaasPlansTemplateItem,
  DbaasSoftwareSummary,
  DbaasSummaryItem,
  DbaasTemplatePlan,
  DbaasVpcConnection,
  DbaasVpcConnectionItem,
  DbaasWhitelistedIp,
  DbaasWhitelistedIpItem,
  DbaasWhitelistedIpTag,
  SupportedDatabaseType
} from './types/index.js';
import {
  compareVersions,
  normalizeHost,
  normalizeOptionalNumber,
  normalizeOptionalString,
  normalizePlanValue,
  normalizePort,
  normalizeSubnetId,
  normalizeSupportedDatabaseTypeOrNull,
  typeToFlagValue
} from './normalizers.js';

export function summarizeEngineTypes(
  databaseEngines: DbaasSoftwareSummary[]
): DbaasListTypeItem[] {
  const items = databaseEngines.flatMap((software) => {
    const type = normalizeSupportedDatabaseTypeOrNull(software.name);
    if (type === null) {
      return [];
    }

    return [
      {
        description: normalizeOptionalString(software.description),
        engine: software.engine,
        software_id: software.id,
        type,
        version: software.version
      }
    ];
  });

  return items.sort((left, right) => {
    const typeComparison = left.type.localeCompare(right.type);
    if (typeComparison !== 0) {
      return typeComparison;
    }

    return compareVersions(right.version, left.version);
  });
}

export function summarizeTemplatePlans(
  type: SupportedDatabaseType,
  version: string,
  templatePlans: DbaasTemplatePlan[]
): DbaasPlansTemplateItem[] {
  return [...templatePlans]
    .map((plan) => ({
      available: plan.available_inventory_status,
      committed_sku: (plan.committed_sku ?? []).flatMap((sku) => {
        if (sku.committed_sku_id === undefined) {
          return [];
        }

        return [
          {
            committed_days: sku.committed_days ?? null,
            committed_sku_id: sku.committed_sku_id,
            committed_sku_name: sku.committed_sku_name ?? '',
            committed_sku_price: sku.committed_sku_price ?? null,
            currency: normalizeOptionalString(plan.currency),
            plan_name: plan.name,
            template_id: plan.template_id
          }
        ];
      }),
      currency: normalizeOptionalString(plan.currency),
      disk: plan.disk,
      name: plan.name,
      price_per_hour: normalizePlanHourlyPrice(plan),
      ram: plan.ram,
      template_id: plan.template_id,
      type,
      version,
      vcpu: plan.cpu
    }))
    .sort((left, right) => {
      if (left.available !== right.available) {
        return left.available ? -1 : 1;
      }

      const priceComparison =
        (left.price_per_hour ?? Number.MAX_SAFE_INTEGER) -
        (right.price_per_hour ?? Number.MAX_SAFE_INTEGER);
      if (priceComparison !== 0) {
        return priceComparison;
      }

      return left.name.localeCompare(right.name);
    });
}

export function resolveSoftware(
  catalog: DbaasPlanCatalog,
  requestedType: SupportedDatabaseType,
  requestedVersion: string
): DbaasSoftwareSummary {
  const matches = catalog.database_engines.filter((software) => {
    const type = normalizeSupportedDatabaseTypeOrNull(software.name);
    return type === requestedType && software.version === requestedVersion;
  });

  const firstMatch = matches[0];
  if (matches.length === 1 && firstMatch !== undefined) {
    return firstMatch;
  }

  const availableVersions = summarizeEngineTypes(catalog.database_engines)
    .filter((item) => item.type === requestedType)
    .map((item) => item.version);
  const versionsSummary =
    availableVersions.length === 0 ? 'none' : availableVersions.join(', ');

  throw new CliError(
    `No supported ${requestedType} engine matches version ${requestedVersion}.`,
    {
      code: 'DBAAS_VERSION_NOT_FOUND',
      details: [`Available versions: ${versionsSummary}`],
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatCliCommand(`dbaas list-types --type ${typeToFlagValue(requestedType)}`)} to inspect valid versions.`
    }
  );
}

export function resolveTemplatePlan(
  catalog: DbaasPlanCatalog,
  requestedPlan: string
): DbaasTemplatePlan {
  const normalizedRequestedPlan = requestedPlan.trim().toLowerCase();
  const exactMatches = catalog.template_plans.filter(
    (item) => item.name.trim().toLowerCase() === normalizedRequestedPlan
  );

  if (exactMatches.length === 0) {
    throw new CliError(`No DBaaS plan matches "${requestedPlan}".`, {
      code: 'DBAAS_PLAN_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Run dbaas plans with the same --type and --db-version values, then retry with one of the listed plan names.'
    });
  }

  const availableMatches = exactMatches.filter(
    (item) => item.available_inventory_status
  );
  const firstAvailableMatch = availableMatches[0];
  if (availableMatches.length === 1 && firstAvailableMatch !== undefined) {
    return firstAvailableMatch;
  }

  if (availableMatches.length > 1) {
    const details = availableMatches.map(
      (item) => `template_id=${item.template_id}, name=${item.name}`
    );

    throw new CliError(
      `Multiple available DBaaS plans match "${requestedPlan}".`,
      {
        code: 'DBAAS_PLAN_AMBIGUOUS',
        details,
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Retry with a more specific plan name after reviewing the output of dbaas plans.'
      }
    );
  }

  throw new CliError(
    `DBaaS plan "${requestedPlan}" is currently unavailable.`,
    {
      code: 'DBAAS_PLAN_UNAVAILABLE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Choose a plan row marked Available=yes from dbaas plans, or retry later once inventory returns.'
    }
  );
}

export function summarizeSupportedCluster(
  cluster: DbaasClusterDetail
): DbaasSummaryItem {
  const summary = summarizeSupportedClusterOrNull(cluster);

  if (summary === null) {
    throw new CliError(
      `DBaaS ${cluster.id} is not one of the supported engines (MariaDB, MySQL, PostgreSQL).`,
      {
        code: 'UNSUPPORTED_DBAAS_ENGINE',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Use this command with MariaDB, MySQL, or PostgreSQL clusters only.'
      }
    );
  }

  return summary;
}

export function summarizeSupportedClusterOrNull(
  cluster: DbaasClusterSummary
): DbaasSummaryItem | null {
  const type = normalizeSupportedDatabaseTypeOrNull(cluster.software.name);
  if (type === null) {
    return null;
  }

  const databaseName = normalizeOptionalString(
    cluster.master_node.database?.database
  );
  const username = normalizeOptionalString(
    cluster.master_node.database?.username
  );

  return {
    connection_string: buildConnectionString(
      type,
      databaseName,
      username,
      cluster.master_node
    ),
    database_name: databaseName,
    id: cluster.id,
    name: cluster.name,
    type,
    username,
    version: cluster.software.version
  };
}

export function summarizeDbaasDetail(
  cluster: DbaasClusterDetail,
  vpcConnections: DbaasVpcConnection[],
  publicIpEnabled: boolean
): DbaasDetailItem {
  const summary = summarizeSupportedCluster(cluster);
  const publicIpAddress = normalizeHost(cluster.master_node.public_ip_address);

  return {
    ...summary,
    connection_endpoint: buildConnectionEndpoint(cluster.master_node),
    connection_port: buildConnectionPort(cluster.master_node),
    created_at: normalizeOptionalString(cluster.created_at),
    plan: summarizePlan(cluster.master_node),
    public_ip: {
      attached: publicIpAddress !== null,
      enabled: publicIpEnabled,
      ip_address: publicIpAddress
    },
    status:
      normalizeOptionalString(cluster.status_title) ??
      normalizeOptionalString(cluster.status),
    vpc_connections: vpcConnections.map(normalizeVpcConnectionItem),
    whitelisted_ips: normalizeWhitelistedIps(cluster)
  };
}

export function summarizePlan(
  masterNode: DbaasClusterSummary['master_node']
): DbaasPlanInfo {
  const plan = masterNode.plan ?? null;

  return {
    configuration: {
      cpu: normalizePlanValue(masterNode.cpu ?? plan?.cpu),
      disk: normalizePlanValue(masterNode.disk ?? plan?.disk),
      ram: normalizePlanValue(masterNode.ram ?? plan?.ram)
    },
    name:
      normalizeOptionalString(plan?.name) ??
      normalizeOptionalString(masterNode.plan_name),
    price: normalizePlanValue(plan?.price),
    price_per_hour: normalizePlanValue(plan?.price_per_hour),
    price_per_month: normalizePlanValue(plan?.price_per_month)
  };
}

export function normalizeVpcConnectionItem(
  connection: DbaasVpcConnection
): DbaasVpcConnectionItem {
  return {
    appliance_id: normalizeOptionalNumber(connection.appliance_id),
    ip_address: normalizeOptionalString(connection.ip_address),
    subnet_id: normalizeSubnetId(connection.subnet, connection.subnets),
    vpc_cidr: normalizeOptionalString(connection.vpc?.ipv4_cidr),
    vpc_id: normalizeOptionalNumber(connection.vpc?.network_id),
    vpc_name: normalizeOptionalString(connection.vpc?.name)
  };
}

export function normalizeWhitelistedIps(
  cluster: DbaasClusterDetail
): DbaasWhitelistedIpItem[] {
  const direct = cluster.whitelisted_ips;
  if (Array.isArray(direct) && direct.length > 0) {
    return direct.map(normalizeWhitelistedIpItem);
  }

  const masterAllowedIps = cluster.master_node.allowed_ip_address;
  const tags = masterAllowedIps?.whitelisted_ips_tags;
  if (Array.isArray(tags) && tags.length > 0) {
    return tags.map(normalizeWhitelistedIpItem);
  }

  const ips = masterAllowedIps?.whitelisted_ips;
  if (!Array.isArray(ips)) {
    return [];
  }

  return ips.flatMap((ip) => {
    const normalizedIp = normalizeOptionalString(ip);
    return normalizedIp === null ? [] : [{ ip: normalizedIp, tags: [] }];
  });
}

export function normalizeWhitelistedIpItem(
  item: DbaasWhitelistedIp
): DbaasWhitelistedIpItem {
  return {
    ip: item.ip,
    tags: normalizeWhitelistTags(item.tag_list ?? item.tags ?? [])
  };
}

export function normalizeWhitelistTags(
  tags: DbaasWhitelistedIpTag[]
): DbaasWhitelistedIpItem['tags'] {
  return tags.map((tag) => ({
    id: normalizeOptionalNumber(tag.id),
    name:
      normalizeOptionalString(tag.label_name) ??
      normalizeOptionalString(tag.tag)
  }));
}

export function buildConnectionEndpoint(
  masterNode: DbaasClusterSummary['master_node']
): string | null {
  const endpoint =
    normalizeHost(masterNode.domain) ??
    normalizeHost(masterNode.private_ip_address) ??
    normalizeHost(masterNode.public_ip_address);
  const publicIp = normalizeHost(masterNode.public_ip_address);

  if (endpoint === null) {
    return null;
  }

  return publicIp === null || endpoint === publicIp
    ? endpoint
    : `${endpoint} (${publicIp})`;
}

export function buildConnectionPort(
  masterNode: DbaasClusterSummary['master_node']
): string | null {
  return normalizePort(masterNode.public_port ?? masterNode.port ?? null);
}

export function buildConnectionString(
  type: SupportedDatabaseType,
  databaseName: string | null,
  username: string | null,
  masterNode: DbaasClusterSummary['master_node']
): string | null {
  const host =
    normalizeHost(masterNode.domain) ??
    normalizeHost(masterNode.public_ip_address) ??
    normalizeHost(masterNode.private_ip_address);
  const port = buildConnectionPort(masterNode);

  if (host === null || username === null) {
    return null;
  }

  if (type === 'PostgreSQL') {
    return databaseName === null
      ? `psql -h ${host}${port === null ? '' : ` -p ${port}`} -U ${username}`
      : `psql -h ${host}${port === null ? '' : ` -p ${port}`} -U ${username} -d ${databaseName}`;
  }

  return `mysql -h ${host}${port === null ? '' : ` -P ${port}`} -u ${username} -p`;
}

export function normalizePlanHourlyPrice(
  plan: DbaasTemplatePlan
): number | null {
  const candidate = plan.price_per_hour ?? plan.price;
  if (typeof candidate === 'number') {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function sortDbaasListItems(items: DbaasListItem[]): DbaasListItem[] {
  return [...items].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    const typeComparison = left.type.localeCompare(right.type);
    if (typeComparison !== 0) {
      return typeComparison;
    }

    const versionComparison = compareVersions(right.version, left.version);
    if (versionComparison !== 0) {
      return versionComparison;
    }

    return left.id - right.id;
  });
}
