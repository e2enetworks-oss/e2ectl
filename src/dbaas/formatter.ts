import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  DbaasCommandResult,
  DbaasCommittedSkuItem,
  DbaasDetailItem,
  DbaasListItem,
  DbaasListTypeItem,
  DbaasPlansTemplateItem,
  DbaasSummaryItem,
  DbaasVpcAttachCommandResult,
  DbaasVpcDetachCommandResult,
  DbaasWhitelistedIpItem
} from './service.js';

export function renderDbaasResult(
  result: DbaasCommandResult,
  json: boolean
): string {
  return json ? renderDbaasJson(result) : renderDbaasHuman(result);
}

export function formatDbaasListTable(items: DbaasListItem[]): string {
  const table = new Table({
    head: [
      'Name',
      'DB Version',
      'Connection Endpoint',
      'Connection Port',
      'Status'
    ]
  });

  items.forEach((item) => {
    table.push([
      item.name,
      formatDbaasVersion(item.type, item.version),
      item.connection_endpoint ?? '',
      item.connection_port ?? '',
      item.status ?? ''
    ]);
  });

  return table.toString();
}

export function formatDbaasListTypesTable(items: DbaasListTypeItem[]): string {
  const table = new Table({
    head: ['Type', 'Version']
  });

  items.forEach((item) => {
    table.push([item.type, item.version]);
  });

  return table.toString();
}

export function formatDbaasTemplatePlansTable(
  items: DbaasPlansTemplateItem[]
): string {
  const table = new Table({
    head: [
      'Plan',
      'Template ID',
      'vCPU',
      'RAM',
      'Disk',
      'Price/Hour',
      'Available'
    ]
  });

  items.forEach((item) => {
    table.push([
      item.name,
      String(item.template_id),
      item.vcpu,
      item.ram,
      item.disk,
      formatPrice(item.price_per_hour, item.currency),
      item.available ? 'yes' : 'no'
    ]);
  });

  return table.toString();
}

export function formatDbaasCommittedSkusTable(
  items: DbaasCommittedSkuItem[]
): string {
  const table = new Table({
    head: ['Plan', 'Template ID', 'SKU ID', 'Term', 'Price']
  });

  items.forEach((item) => {
    table.push([
      item.plan_name,
      String(item.template_id),
      String(item.committed_sku_id),
      item.committed_days === null ? '' : `${item.committed_days} days`,
      formatPrice(item.committed_sku_price, item.currency)
    ]);
  });

  return table.toString();
}

function renderDbaasHuman(result: DbaasCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Created DBaaS: ${result.dbaas.name}\n` +
        `ID: ${result.dbaas.id}\n` +
        `DB Version: ${formatDbaasVersion(result.dbaas.type, result.dbaas.version)}\n` +
        `Database Name: ${result.dbaas.database_name ?? ''}\n` +
        `Connection String: ${result.dbaas.connection_string ?? ''}\n` +
        `Billing Type: ${result.requested.billing_type}\n` +
        (result.requested.committed_plan_id === undefined
          ? ''
          : `Committed Plan ID: ${result.requested.committed_plan_id}\n`) +
        (result.requested.vpc_id === undefined
          ? ''
          : `VPC ID: ${result.requested.vpc_id}\n`) +
        '\n' +
        `Next: run ${formatCliCommand('dbaas list')} to inspect the current state.\n`
      );
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted DBaaS ${result.dbaas_id}${renderDeletedDbaasSummary(result.dbaas)}\n`;
    case 'get':
      return renderGetHuman(result.dbaas);
    case 'list':
      return result.items.length === 0
        ? 'No supported DBaaS clusters found.\n'
        : `${formatDbaasListTable(result.items)}\n`;
    case 'list-types':
      return renderListTypesHuman(result);
    case 'plans':
      return renderTemplatePlansHuman(result);
    case 'reset-password':
      return (
        `Password reset requested for DBaaS: ${result.dbaas.name}\n` +
        `ID: ${result.dbaas.id}\n` +
        `DB Version: ${formatDbaasVersion(result.dbaas.type, result.dbaas.version)}\n` +
        `Username: ${result.dbaas.username ?? ''}\n` +
        `Message: ${result.message}\n`
      );
    case 'skus':
      return renderSkusHuman(result);
    case 'vpc-attach':
      return renderVpcAttachHuman(result);
    case 'vpc-detach':
      return renderVpcDetachHuman(result);
    case 'public-ip-attach':
      return (
        `Public IP attach requested for DBaaS ${result.dbaas_id}.\n` +
        (result.message === null ? '' : `Message: ${result.message}\n`)
      );
    case 'public-ip-detach':
      return result.cancelled
        ? 'Public IP detach cancelled.\n'
        : `Public IP detach requested for DBaaS ${result.dbaas_id}.\n` +
            (result.message === null ? '' : `Message: ${result.message}\n`);
    case 'whitelist-list':
      return result.items.length === 0
        ? `No whitelisted IPs found for DBaaS ${result.dbaas_id}.\n`
        : `${formatWhitelistedIpsTable(result.items)}\n`;
    case 'whitelist-add':
      return (
        `Whitelisted IP ${result.ip} for DBaaS ${result.dbaas_id}.\n` +
        (result.message === null ? '' : `Message: ${result.message}\n`)
      );
    case 'whitelist-remove':
      return (
        `Removed whitelisted IP ${result.ip} from DBaaS ${result.dbaas_id}.\n` +
        (result.message === null ? '' : `Message: ${result.message}\n`)
      );
  }
}

function renderGetHuman(item: DbaasDetailItem): string {
  const vpcSection =
    item.vpc_connections.length === 0
      ? 'VPC Connections: none\n'
      : `VPC Connections:\n${formatVpcConnectionsTable(item.vpc_connections)}\n`;
  const whitelistSection =
    item.whitelisted_ips.length === 0
      ? 'Whitelisted IPs: none\n'
      : `Whitelisted IPs:\n${formatWhitelistedIpsTable(item.whitelisted_ips)}\n`;

  return (
    `DBaaS: ${item.name}\n` +
    `ID: ${item.id}\n` +
    `DB Version: ${formatDbaasVersion(item.type, item.version)}\n` +
    `Plan Name: ${item.plan.name ?? ''}\n` +
    `Price: ${item.plan.price ?? ''}\n` +
    `Price/Hour: ${item.plan.price_per_hour ?? ''}\n` +
    `Price/Month: ${item.plan.price_per_month ?? ''}\n` +
    `DBaaS Configuration: ${formatConfiguration(item)}\n` +
    `Connection Endpoint: ${item.connection_endpoint ?? ''}\n` +
    `Connection Port: ${item.connection_port ?? ''}\n` +
    `Connection String: ${item.connection_string ?? ''}\n` +
    `Status: ${item.status ?? ''}\n` +
    `Public IP Enabled: ${item.public_ip.enabled ? 'yes' : 'no'}\n` +
    `Public IP: ${item.public_ip.ip_address ?? ''}\n` +
    vpcSection +
    whitelistSection
  );
}

function renderListTypesHuman(result: {
  filters: { type: string | null };
  items: DbaasListTypeItem[];
  total_count: number;
}): string {
  if (result.items.length === 0) {
    return 'No supported DBaaS engine types found.\n';
  }

  const scope =
    result.filters.type === null
      ? `Supported DBaaS engine types (${result.total_count})`
      : `Supported ${result.filters.type} versions (${result.total_count})`;

  return (
    `${scope}\n${formatDbaasListTypesTable(result.items)}\n\n` +
    'Inspect plans for one engine version:\n' +
    `${formatCliCommand('dbaas plans --type <database-type> --db-version <version>')}\n`
  );
}

function renderTemplatePlansHuman(result: {
  filters: { type: string; version: string };
  items: DbaasPlansTemplateItem[];
  total_count: number;
}): string {
  const title = `Plans for ${formatDbaasVersion(result.filters.type, result.filters.version)} (${result.total_count})`;

  if (result.items.length === 0) {
    return `${title}\nNo DBaaS plans found.\n`;
  }

  const allSkus = result.items.flatMap((item) => item.committed_sku);
  const committedSection =
    allSkus.length === 0
      ? ''
      : `\nCommitted SKU options (use --billing-type committed --committed-plan-id <SKU ID>):\n` +
        `${formatDbaasCommittedSkusTable(allSkus)}\n`;

  return (
    `${title}\n${formatDbaasTemplatePlansTable(result.items)}\n` +
    committedSection +
    '\nCreate with a plan name:\n' +
    `${formatCliCommand('dbaas create --name <name> --type <database-type> --db-version <version> --plan <plan-name> --database-name <database-name> --password-file <path>')}\n`
  );
}

function renderSkusHuman(result: {
  filters: { type: string; version: string };
  items: DbaasCommittedSkuItem[];
  total_count: number;
}): string {
  const title = `Committed SKUs for ${formatDbaasVersion(result.filters.type, result.filters.version)} (${result.total_count})`;

  if (result.items.length === 0) {
    return `${title}\nNo committed SKUs found.\n`;
  }

  return (
    `${title}\n${formatDbaasCommittedSkusTable(result.items)}\n\n` +
    'Create with a committed plan:\n' +
    `${formatCliCommand('dbaas create --name <name> --type <database-type> --db-version <version> --plan <plan-name> --database-name <database-name> --password-file <path> --billing-type committed --committed-plan-id <SKU ID>')}\n`
  );
}

function renderVpcAttachHuman(result: DbaasVpcAttachCommandResult): string {
  return (
    `Attached VPC ${result.vpc.id} (${result.vpc.name}) to DBaaS ${result.dbaas_id}.\n` +
    (result.vpc.subnet_id === null
      ? ''
      : `Subnet ID: ${result.vpc.subnet_id}\n`)
  );
}

function renderVpcDetachHuman(result: DbaasVpcDetachCommandResult): string {
  return (
    `Detached VPC ${result.vpc.id} (${result.vpc.name}) from DBaaS ${result.dbaas_id}.\n` +
    (result.vpc.subnet_id === null
      ? ''
      : `Subnet ID: ${result.vpc.subnet_id}\n`) +
    (result.message === null ? '' : `Message: ${result.message}\n`)
  );
}

function formatVpcConnectionsTable(
  items: DbaasDetailItem['vpc_connections']
): string {
  const table = new Table({
    head: ['VPC ID', 'VPC Name', 'CIDR', 'Private IP', 'Subnet ID']
  });

  items.forEach((item) => {
    table.push([
      item.vpc_id === null ? '' : String(item.vpc_id),
      item.vpc_name ?? '',
      item.vpc_cidr ?? '',
      item.ip_address ?? '',
      item.subnet_id === null ? '' : String(item.subnet_id)
    ]);
  });

  return table.toString();
}

function formatWhitelistedIpsTable(items: DbaasWhitelistedIpItem[]): string {
  const table = new Table({
    head: ['IP', 'Tags']
  });

  items.forEach((item) => {
    table.push([
      item.ip,
      item.tags
        .map((tag) => tag.name ?? (tag.id === null ? '' : String(tag.id)))
        .filter((tag) => tag.length > 0)
        .join(', ')
    ]);
  });

  return table.toString();
}

function renderDbaasJson(result: DbaasCommandResult): string {
  return `${stableStringify(normalizeDbaasJson(result))}\n`;
}

function normalizeDbaasJson(result: DbaasCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        dbaas: normalizeSummaryJson(result.dbaas),
        requested: {
          billing_type: result.requested.billing_type,
          ...(result.requested.committed_plan_id === undefined
            ? {}
            : { committed_plan_id: result.requested.committed_plan_id }),
          database_name: result.requested.database_name,
          name: result.requested.name,
          plan: result.requested.plan,
          public_ip: result.requested.public_ip,
          template_id: result.requested.template_id,
          type: result.requested.type,
          username: result.requested.username,
          version: result.requested.version,
          ...(result.requested.vpc_id === undefined
            ? {}
            : { vpc_id: result.requested.vpc_id })
        }
      };
    case 'delete':
      return {
        action: 'delete',
        cancelled: result.cancelled,
        dbaas:
          result.dbaas === null ? null : normalizeSummaryJson(result.dbaas),
        dbaas_id: result.dbaas_id,
        ...(result.message === undefined ? {} : { message: result.message })
      };
    case 'get':
      return {
        action: 'get',
        dbaas: normalizeDetailJson(result.dbaas)
      };
    case 'list':
      return {
        action: 'list',
        filters: { type: result.filters.type },
        items: result.items.map((item) => ({
          connection_string: item.connection_string,
          connection_endpoint: item.connection_endpoint,
          connection_port: item.connection_port,
          database_name: item.database_name,
          id: item.id,
          name: item.name,
          public_ip: item.public_ip,
          status: item.status,
          type: item.type,
          version: item.version
        })),
        total_count: result.total_count,
        total_page_number: result.total_page_number
      };
    case 'list-types':
      return {
        action: 'list-types',
        filters: { type: result.filters.type },
        items: result.items.map((item) => ({
          description: item.description,
          engine: item.engine,
          software_id: item.software_id,
          type: item.type,
          version: item.version
        })),
        total_count: result.total_count
      };
    case 'plans':
      return {
        action: 'plans',
        filters: { type: result.filters.type, version: result.filters.version },
        items: result.items.map((item) => ({
          available: item.available,
          committed_sku: item.committed_sku.map((sku) => ({
            committed_days: sku.committed_days,
            committed_sku_id: sku.committed_sku_id,
            committed_sku_name: sku.committed_sku_name,
            committed_sku_price: sku.committed_sku_price,
            currency: sku.currency
          })),
          currency: item.currency,
          disk: item.disk,
          name: item.name,
          price_per_hour: item.price_per_hour,
          ram: item.ram,
          template_id: item.template_id,
          type: item.type,
          vcpu: item.vcpu,
          version: item.version
        })),
        total_count: result.total_count
      };
    case 'reset-password':
      return {
        action: 'reset-password',
        dbaas: normalizeSummaryJson(result.dbaas),
        message: result.message
      };
    case 'skus':
      return {
        action: 'skus',
        filters: { type: result.filters.type, version: result.filters.version },
        items: result.items.map((item) => ({
          committed_days: item.committed_days,
          committed_sku_id: item.committed_sku_id,
          committed_sku_name: item.committed_sku_name,
          committed_sku_price: item.committed_sku_price,
          currency: item.currency,
          plan_name: item.plan_name,
          template_id: item.template_id
        })),
        total_count: result.total_count
      };
    case 'vpc-attach':
      return {
        action: 'vpc-attach',
        dbaas_id: result.dbaas_id,
        vpc: {
          id: result.vpc.id,
          name: result.vpc.name,
          subnet_id: result.vpc.subnet_id
        }
      };
    case 'vpc-detach':
      return {
        action: 'vpc-detach',
        dbaas_id: result.dbaas_id,
        message: result.message,
        vpc: {
          id: result.vpc.id,
          name: result.vpc.name,
          subnet_id: result.vpc.subnet_id
        }
      };
    case 'public-ip-attach':
      return {
        action: 'public-ip-attach',
        dbaas_id: result.dbaas_id,
        message: result.message
      };
    case 'public-ip-detach':
      return {
        action: 'public-ip-detach',
        cancelled: result.cancelled,
        dbaas_id: result.dbaas_id,
        message: result.message
      };
    case 'whitelist-list':
      return {
        action: 'whitelist-list',
        dbaas_id: result.dbaas_id,
        items: result.items.map((item) => ({
          ip: item.ip,
          tags: item.tags.map((tag) => ({
            id: tag.id,
            name: tag.name
          }))
        })),
        total_count: result.total_count
      };
    case 'whitelist-add':
    case 'whitelist-remove':
      return {
        action: result.action,
        dbaas_id: result.dbaas_id,
        ip: result.ip,
        message: result.message,
        tag_ids: result.tag_ids
      };
  }
}

function normalizeSummaryJson(item: DbaasSummaryItem): JsonValue {
  return {
    connection_string: item.connection_string,
    database_name: item.database_name,
    id: item.id,
    name: item.name,
    type: item.type,
    username: item.username,
    version: item.version
  };
}

function normalizeDetailJson(item: DbaasDetailItem): JsonValue {
  return {
    connection_string: item.connection_string,
    database_name: item.database_name,
    id: item.id,
    name: item.name,
    type: item.type,
    username: item.username,
    version: item.version,
    connection_endpoint: item.connection_endpoint,
    connection_port: item.connection_port,
    created_at: item.created_at,
    plan: {
      configuration: {
        cpu: item.plan.configuration.cpu,
        disk: item.plan.configuration.disk,
        ram: item.plan.configuration.ram
      },
      name: item.plan.name,
      price: item.plan.price,
      price_per_hour: item.plan.price_per_hour,
      price_per_month: item.plan.price_per_month
    },
    public_ip: {
      attached: item.public_ip.attached,
      enabled: item.public_ip.enabled,
      ip_address: item.public_ip.ip_address
    },
    status: item.status,
    vpc_connections: item.vpc_connections.map((connection) => ({
      appliance_id: connection.appliance_id,
      ip_address: connection.ip_address,
      subnet_id: connection.subnet_id,
      vpc_cidr: connection.vpc_cidr,
      vpc_id: connection.vpc_id,
      vpc_name: connection.vpc_name
    })),
    whitelisted_ips: item.whitelisted_ips.map((whitelistedIp) => ({
      ip: whitelistedIp.ip,
      tags: whitelistedIp.tags.map((tag) => ({
        id: tag.id,
        name: tag.name
      }))
    }))
  };
}

function formatDbaasVersion(type: string, version: string): string {
  return `${type} ${version}`;
}

function formatConfiguration(item: DbaasDetailItem): string {
  const parts = [
    item.plan.configuration.cpu === null
      ? null
      : `${item.plan.configuration.cpu} vCPU`,
    item.plan.configuration.ram === null
      ? null
      : `${item.plan.configuration.ram} RAM`,
    item.plan.configuration.disk === null
      ? null
      : `${item.plan.configuration.disk} disk`
  ].filter((part): part is string => part !== null);

  return parts.join(', ');
}

function formatPrice(amount: number | null, currency: string | null): string {
  if (amount === null) {
    return '';
  }

  return currency === null ? String(amount) : `${amount} ${currency}`;
}

function renderDeletedDbaasSummary(item: DbaasSummaryItem | null): string {
  if (item === null) {
    return '.';
  }

  return ` (${item.name}, ${formatDbaasVersion(item.type, item.version)}).`;
}
