import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  DbaasCommandResult,
  DbaasListItem,
  DbaasPlansEngineCommandResult,
  DbaasPlansEngineItem,
  DbaasPlansTemplateCommandResult,
  DbaasPlansTemplateItem,
  DbaasSummaryItem
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

export function formatDbaasEnginePlansTable(
  items: DbaasPlansEngineItem[]
): string {
  const table = new Table({
    head: ['Type', 'Version', 'Software ID', 'Engine']
  });

  items.forEach((item) => {
    table.push([
      item.type,
      item.version,
      String(item.software_id),
      item.engine
    ]);
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

function renderDbaasHuman(result: DbaasCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Created DBaaS: ${result.dbaas.name}\n` +
        `ID: ${result.dbaas.id}\n` +
        `DB Version: ${formatDbaasVersion(result.dbaas.type, result.dbaas.version)}\n` +
        `Database Name: ${result.dbaas.database_name ?? ''}\n` +
        `Connection String: ${result.dbaas.connection_string ?? ''}\n` +
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
    case 'plans':
      return result.mode === 'engines'
        ? renderEnginePlansHuman(result)
        : renderTemplatePlansHuman(result);
    case 'reset-password':
      return (
        `Password reset requested for DBaaS: ${result.dbaas.name}\n` +
        `ID: ${result.dbaas.id}\n` +
        `DB Version: ${formatDbaasVersion(result.dbaas.type, result.dbaas.version)}\n` +
        `Username: ${result.dbaas.username ?? ''}\n` +
        `Message: ${result.message}\n`
      );
  }
}

function renderEnginePlansHuman(result: DbaasPlansEngineCommandResult): string {
  if (result.items.length === 0) {
    return 'No supported DBaaS engines found.\n';
  }

  const scope =
    result.filters.type === null
      ? `Supported DBaaS engines (${result.total_count})`
      : `Supported ${result.filters.type} versions (${result.total_count})`;

  return (
    `${scope}\n${formatDbaasEnginePlansTable(result.items)}\n\n` +
    'Inspect plans for one engine version:\n' +
    `${formatCliCommand('dbaas plans --type <database-type> --db-version <version>')}\n`
  );
}

function renderTemplatePlansHuman(
  result: DbaasPlansTemplateCommandResult
): string {
  const title = `Plans for ${formatDbaasVersion(result.filters.type, result.filters.version)} (${result.total_count})`;

  if (result.items.length === 0) {
    return `${title}\nNo DBaaS plans found.\n`;
  }

  return (
    `${title}\n${formatDbaasTemplatePlansTable(result.items)}\n\n` +
    'Create with one of these plan names:\n' +
    `${formatCliCommand('dbaas create --name <name> --type <database-type> --db-version <version> --plan <plan-name> --database-name <database-name> --password-file <path>')}\n`
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
          database_name: result.requested.database_name,
          name: result.requested.name,
          plan: result.requested.plan,
          public_ip: result.requested.public_ip,
          template_id: result.requested.template_id,
          type: result.requested.type,
          username: result.requested.username,
          version: result.requested.version
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
        filters: {
          type: result.filters.type
        },
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
    case 'plans':
      return result.mode === 'engines'
        ? {
            action: 'plans',
            filters: {
              type: result.filters.type,
              version: result.filters.version
            },
            items: result.items.map((item) => ({
              description: item.description,
              engine: item.engine,
              software_id: item.software_id,
              type: item.type,
              version: item.version
            })),
            mode: 'engines',
            total_count: result.total_count
          }
        : {
            action: 'plans',
            filters: {
              type: result.filters.type,
              version: result.filters.version
            },
            items: result.items.map((item) => ({
              available: item.available,
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
            mode: 'templates',
            total_count: result.total_count
          };
    case 'reset-password':
      return {
        action: 'reset-password',
        dbaas: normalizeSummaryJson(result.dbaas),
        message: result.message
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
