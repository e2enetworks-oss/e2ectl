import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  DnsCommandResult,
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
        `IPv4: ${result.domain.ip_address}\n` +
        `Domain TTL: ${result.domain.domain_ttl ?? ''}\n` +
        '\n' +
        (result.domain.rrsets.length === 0
          ? 'No rrsets returned.\n'
          : `${formatDnsRrsetsTable(result.domain.rrsets)}\n`)
      );
    case 'list':
      return result.items.length === 0
        ? 'No DNS domains found.\n'
        : `${formatDnsListTable(result.items)}\n`;
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
          rrsets: result.domain.rrsets.map((rrset) => normalizeRrsetJson(rrset))
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

function sortDnsListItems(items: DnsListItem[]): DnsListItem[] {
  return [...items].sort((left, right) =>
    left.domain_name.localeCompare(right.domain_name)
  );
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
