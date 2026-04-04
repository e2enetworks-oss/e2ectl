import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  DnsCommandResult,
  DnsDerivedSoaItem,
  DnsFlattenedRecordItem,
  DnsListItem,
  DnsZoneRecordItem,
  DnsZoneRrsetItem
} from './service.js';

export function renderDnsResult(
  result: DnsCommandResult,
  json: boolean
): string {
  return json ? renderDnsJson(result) : renderDnsHuman(result);
}

export function formatDnsListTable(items: DnsListItem[]): string {
  const table = new Table({
    head: ['Domain', 'IPv4', 'Validity', 'Created At', 'Deleted']
  });

  sortDnsListItems(items).forEach((item) => {
    table.push([
      item.domain_name,
      item.ip_address,
      item.validity ?? '',
      item.created_at ?? '',
      item.deleted ? 'yes' : 'no'
    ]);
  });

  return table.toString();
}

export function formatDnsRecordTable(items: DnsFlattenedRecordItem[]): string {
  const table = new Table({
    head: ['Type', 'Name', 'TTL', 'Value']
  });

  items.forEach((item) => {
    table.push([
      item.type,
      item.name,
      item.ttl === null ? '' : String(item.ttl),
      item.disabled ? `${item.value} (disabled)` : item.value
    ]);
  });

  return table.toString();
}

export function formatDnsRrsetsTable(rrsets: DnsZoneRrsetItem[]): string {
  const table = new Table({
    head: ['Type', 'Name', 'TTL', 'Records']
  });

  rrsets.forEach((rrset) => {
    table.push([
      rrset.type,
      rrset.name,
      rrset.ttl === null ? '' : String(rrset.ttl),
      formatDnsRecords(rrset.records)
    ]);
  });

  return table.toString();
}

function formatDnsRecords(records: DnsZoneRecordItem[]): string {
  return records
    .map((record) =>
      record.disabled ? `${record.content} (disabled)` : record.content
    )
    .join('\n');
}

function renderDnsHuman(result: DnsCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Created DNS domain request: ${result.requested.domain_name}\n` +
        `Requested IP: ${result.requested.ip_address}\n` +
        `Created Domain ID: ${result.domain.id}\n` +
        `Message: ${result.message}\n` +
        '\n' +
        `Next: run ${formatCliCommand(`dns get ${result.requested.domain_name}`)} to inspect the zone.\n`
      );
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted DNS domain ${result.domain_name}.\nMessage: ${result.message ?? ''}\n`;
    case 'get':
      return (
        `Domain: ${result.domain.domain_name}\n` +
        `Apex IPv4: ${result.domain.ip_address}\n` +
        `Domain TTL: ${result.domain.domain_ttl ?? ''}\n` +
        `Nameservers: ${formatStringList(result.domain.nameservers)}\n` +
        formatSoaHuman(result.domain.soa) +
        '\n' +
        (result.domain.records.length === 0
          ? 'Forward Records: none\n'
          : `Forward Records:\n${formatDnsRecordTable(result.domain.records)}\n`)
      );
    case 'list':
      return result.items.length === 0
        ? 'No DNS domains found.\n'
        : `${formatDnsListTable(result.items)}\n`;
    case 'nameservers':
      return (
        `Domain: ${result.domain_name}\n` +
        `Status: ${result.status ? 'ok' : 'error'}\n` +
        `Message: ${result.message}\n` +
        `Authority Match: ${result.authority_match ? 'yes' : 'no'}\n` +
        `Problem: ${formatOptionalNumber(result.problem)}\n` +
        `Configured Nameservers: ${formatStringList(
          result.configured_nameservers
        )}\n` +
        `Delegated Nameservers: ${formatStringList(
          result.delegated_nameservers
        )}\n`
      );
    case 'record-create':
      return (
        `Created DNS record ${result.record.type} ${result.record.name}.\n` +
        `Value: ${result.record.value}\n` +
        `TTL: ${result.record.ttl ?? ''}\n` +
        `Message: ${result.message}\n`
      );
    case 'record-delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted DNS record ${result.record.type} ${result.record.name} ${result.record.value}.\nMessage: ${result.message ?? ''}\n`;
    case 'record-list':
      return result.items.length === 0
        ? 'No forward DNS records found.\n'
        : `${formatDnsRecordTable(result.items)}\n`;
    case 'record-update':
      return (
        `Updated DNS record ${result.record.type} ${result.record.name}.\n` +
        `Current Value: ${result.record.current_value}\n` +
        `New Value: ${result.record.new_value}\n` +
        `TTL: ${result.record.ttl ?? ''}\n` +
        `Message: ${result.message}\n`
      );
    case 'verify-ns':
      return (
        `Domain: ${result.domain_name}\n` +
        `Status: ${result.status ? 'ok' : 'error'}\n` +
        `Message: ${result.message}\n` +
        `Authority: ${formatOptionalBoolean(result.authority)}\n` +
        `Problem: ${formatOptionalNumber(result.problem)}\n` +
        `Global Nameservers: ${formatStringList(result.global_nameservers)}\n` +
        `E2E Nameservers: ${formatStringList(result.e2e_nameservers)}\n`
      );
    case 'verify-ttl':
      return (
        `Domain: ${result.domain_name}\n` +
        `Status: ${result.status ? 'ok' : 'error'}\n` +
        `Message: ${result.message}\n` +
        `Low TTL RRsets: ${result.low_ttl_count}\n` +
        (result.low_ttl_records.length === 0
          ? ''
          : `\n${formatDnsRrsetsTable(result.low_ttl_records)}\n`)
      );
    case 'verify-validity':
      return (
        `Domain: ${result.domain_name}\n` +
        `Status: ${result.status ? 'ok' : 'error'}\n` +
        `Message: ${result.message}\n` +
        `Validity OK: ${formatOptionalBoolean(result.validity_ok)}\n` +
        `Problem: ${formatOptionalNumber(result.problem)}\n` +
        `Expiry Date: ${result.expiry_date ?? ''}\n`
      );
  }
}

function renderDnsJson(result: DnsCommandResult): string {
  return `${stableStringify(normalizeDnsJson(result))}\n`;
}

function normalizeDnsJson(result: DnsCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        domain: {
          id: result.domain.id
        },
        message: result.message,
        requested: {
          domain_name: result.requested.domain_name,
          ip_address: result.requested.ip_address
        }
      };
    case 'delete':
      return result.cancelled
        ? {
            action: 'delete',
            cancelled: true,
            domain_name: result.domain_name
          }
        : {
            action: 'delete',
            cancelled: false,
            domain_name: result.domain_name,
            message: result.message ?? ''
          };
    case 'get':
      return {
        action: 'get',
        domain: {
          domain_name: result.domain.domain_name,
          domain_ttl: result.domain.domain_ttl,
          ip_address: result.domain.ip_address,
          nameservers: [...result.domain.nameservers],
          records: result.domain.records.map((item) =>
            normalizeRecordJson(item)
          ),
          rrsets: result.domain.rrsets.map((rrset) =>
            normalizeRrsetJson(rrset)
          ),
          soa: normalizeSoaJson(result.domain.soa)
        }
      };
    case 'list':
      return {
        action: 'list',
        items: sortDnsListItems(result.items).map((item) => ({
          created_at: item.created_at,
          deleted: item.deleted,
          domain_name: item.domain_name,
          id: item.id,
          ip_address: item.ip_address,
          validity: item.validity
        }))
      };
    case 'nameservers':
      return {
        action: 'nameservers',
        authority_match: result.authority_match,
        configured_nameservers: [...result.configured_nameservers],
        delegated_nameservers: [...result.delegated_nameservers],
        domain_name: result.domain_name,
        message: result.message,
        problem: result.problem,
        status: result.status
      };
    case 'record-create':
      return {
        action: 'record-create',
        domain_name: result.domain_name,
        message: result.message,
        record: {
          name: result.record.name,
          ttl: result.record.ttl,
          type: result.record.type,
          value: result.record.value
        }
      };
    case 'record-delete':
      return result.cancelled
        ? {
            action: 'record-delete',
            cancelled: true,
            domain_name: result.domain_name,
            record: {
              name: result.record.name,
              type: result.record.type,
              value: result.record.value
            }
          }
        : {
            action: 'record-delete',
            cancelled: false,
            domain_name: result.domain_name,
            message: result.message ?? '',
            record: {
              name: result.record.name,
              type: result.record.type,
              value: result.record.value
            }
          };
    case 'record-list':
      return {
        action: 'record-list',
        domain_name: result.domain_name,
        items: result.items.map((item) => normalizeRecordJson(item))
      };
    case 'record-update':
      return {
        action: 'record-update',
        domain_name: result.domain_name,
        message: result.message,
        record: {
          current_value: result.record.current_value,
          name: result.record.name,
          new_value: result.record.new_value,
          ttl: result.record.ttl,
          type: result.record.type
        }
      };
    case 'verify-ns':
      return {
        action: 'verify-ns',
        authority: result.authority,
        domain_name: result.domain_name,
        e2e_nameservers: [...result.e2e_nameservers],
        global_nameservers: [...result.global_nameservers],
        message: result.message,
        problem: result.problem,
        status: result.status
      };
    case 'verify-ttl':
      return {
        action: 'verify-ttl',
        domain_name: result.domain_name,
        low_ttl_count: result.low_ttl_count,
        low_ttl_records: result.low_ttl_records.map((rrset) =>
          normalizeRrsetJson(rrset)
        ),
        message: result.message,
        status: result.status
      };
    case 'verify-validity':
      return {
        action: 'verify-validity',
        domain_name: result.domain_name,
        expiry_date: result.expiry_date,
        message: result.message,
        problem: result.problem,
        status: result.status,
        validity_ok: result.validity_ok
      };
  }
}

function formatOptionalBoolean(value: boolean | null): string {
  if (value === null) {
    return '';
  }

  return value ? 'yes' : 'no';
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function formatStringList(values: string[]): string {
  return values.length === 0 ? '' : values.join(', ');
}

function formatSoaHuman(soa: DnsDerivedSoaItem | null): string {
  if (soa === null) {
    return 'SOA: \n';
  }

  return (
    `SOA Name: ${soa.name}\n` +
    `SOA TTL: ${soa.ttl ?? ''}\n` +
    `SOA Values: ${soa.values.join(' | ')}\n`
  );
}

function normalizeRecordJson(item: DnsFlattenedRecordItem): JsonValue {
  return {
    disabled: item.disabled,
    name: item.name,
    ttl: item.ttl,
    type: item.type,
    value: item.value
  };
}

function normalizeRrsetJson(rrset: DnsZoneRrsetItem): JsonValue {
  return {
    name: rrset.name,
    records: rrset.records.map((record) => ({
      content: record.content,
      disabled: record.disabled
    })),
    ttl: rrset.ttl,
    type: rrset.type
  };
}

function normalizeSoaJson(soa: DnsDerivedSoaItem | null): JsonValue {
  if (soa === null) {
    return null;
  }

  return {
    name: soa.name,
    ttl: soa.ttl,
    values: [...soa.values]
  };
}

function sortDnsListItems(items: DnsListItem[]): DnsListItem[] {
  return [...items].sort((left, right) =>
    left.domain_name.localeCompare(right.domain_name)
  );
}
