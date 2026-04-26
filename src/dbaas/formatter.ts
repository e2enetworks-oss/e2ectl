import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  DbaasCommandResult,
  DbaasCommittedSkuItem,
  DbaasListItem,
  DbaasListTypeItem,
  DbaasPlansTemplateItem,
  DbaasSummaryItem,
  DbaasVpcAttachCommandResult
} from './service.js';

export function renderDbaasResult(
  result: DbaasCommandResult,
  json: boolean
): string {
  return json ? renderDbaasJson(result) : renderDbaasHuman(result);
}

export function formatDbaasListTable(items: DbaasListItem[]): string {
  const table = new Table({
    head: ['Name', 'DB Version', 'Database Name', 'Connection String']
  });

  items.forEach((item) => {
    table.push([
      item.name,
      formatDbaasVersion(item.type, item.version),
      item.database_name ?? '',
      item.connection_string ?? ''
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
  }
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
    case 'list':
      return {
        action: 'list',
        filters: { type: result.filters.type },
        items: result.items.map((item) => ({
          connection_string: item.connection_string,
          database_name: item.database_name,
          id: item.id,
          name: item.name,
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

function formatDbaasVersion(type: string, version: string): string {
  return `${type} ${version}`;
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
