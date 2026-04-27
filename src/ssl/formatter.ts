import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { SslCommandResult } from './service.js';
import type { SslCertificateSummary } from './types.js';

export function renderSslResult(
  result: SslCommandResult,
  json: boolean
): string {
  return json ? `${stableStringify(toJson(result))}\n` : renderHuman(result);
}

function renderHuman(result: SslCommandResult): string {
  if (result.items.length === 0) {
    return 'No SSL certificates found.\n';
  }

  const table = new Table({
    head: ['ID', 'Name', 'Type', 'Status', 'Common Name', 'Expires']
  });

  for (const item of result.items) {
    table.push([
      String(item.id),
      getCertificateName(item),
      item.ssl_certificate_type ?? '--',
      item.status ?? '--',
      item.common_name ?? '--',
      item.expiry_date ?? '--'
    ]);
  }

  return `${table.toString()}\n`;
}

function toJson(result: SslCommandResult): JsonValue {
  return {
    action: result.action,
    items: result.items.map((item) => ({
      id: item.id,
      name: getCertificateName(item),
      ssl_certificate_type: item.ssl_certificate_type ?? null,
      status: item.status ?? null,
      common_name: item.common_name ?? null,
      expiry_date: item.expiry_date ?? null,
      created_at: item.created_at ?? null
    }))
  };
}

function getCertificateName(item: SslCertificateSummary): string {
  return (
    item.ssl_cert_name ??
    item.certificate_name ??
    item.name ??
    item.common_name ??
    String(item.id)
  );
}
