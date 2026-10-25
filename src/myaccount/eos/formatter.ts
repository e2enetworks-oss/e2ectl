import { buildTable } from '../../core/table.js';

import { stableStringify, type JsonValue } from '../../core/json.js';
import { formatMyAccountCommand } from '../api.js';
import type {
  EosAccessItem,
  EosBucketItem,
  EosCommandResult,
  EosKeyItem
} from './types.js';

export function renderEosResult(
  result: EosCommandResult,
  json: boolean
): string {
  return json
    ? `${stableStringify(result as unknown as JsonValue)}\n`
    : `${renderEosHuman(result)}\n`;
}

function renderEosHuman(result: EosCommandResult): string {
  switch (result.action) {
    case 'bucket-list':
      return formatBuckets(result.items);
    case 'bucket-create':
      return `Created bucket ${result.bucket.name}.\nGive a key access with ${formatMyAccountCommand(`eos access grant ${result.bucket.name} --access-key <key> --role writer`)}.`;
    case 'bucket-delete':
      return result.cancelled
        ? 'Deletion cancelled.'
        : `Deleting bucket ${result.name} and its objects. E2E finishes this in the background; it leaves eos bucket list when done.`;
    case 'key-list':
      return formatKeys(result.items);
    case 'key-create':
      return [
        `Created access key "${result.key.name}".`,
        `Access key: ${result.key.access_key}`,
        `Secret key: ${result.key.secret_key}`,
        `Endpoint:   ${result.endpoint ?? ''}`,
        'Save the secret key now; e2ectl shows it only here.'
      ].join('\n');
    case 'key-delete':
      return result.cancelled
        ? 'Deletion cancelled.'
        : `Deleted access key ${result.access_key}.`;
    case 'access-list':
    case 'access-grant':
      return formatAccess(result.bucket, result.items);
    case 'access-revoke':
      return `Access key ${result.access_key} can no longer use bucket ${result.bucket}.`;
  }
}

function formatBuckets(items: EosBucketItem[]): string {
  if (items.length === 0) {
    return 'No buckets found.';
  }

  const table = buildTable({
    head: ['Name', 'Status', 'Used (MB)', 'Created']
  });
  for (const item of items) {
    table.push([
      item.name,
      item.status,
      item.used_mb === null ? '' : String(item.used_mb),
      item.created_at
    ]);
  }
  return table.toString();
}

function formatKeys(items: EosKeyItem[]): string {
  if (items.length === 0) {
    return 'No access keys found.';
  }

  const table = buildTable({ head: ['ID', 'Name', 'Access Key', 'Disabled'] });
  for (const item of items) {
    table.push([
      String(item.id),
      item.name,
      item.access_key,
      item.disabled ? 'yes' : 'no'
    ]);
  }
  return table.toString();
}

function formatAccess(bucket: string, items: EosAccessItem[]): string {
  if (items.length === 0) {
    return `No keys have access to bucket ${bucket}.`;
  }

  const table = buildTable({ head: ['ID', 'Key Name', 'Access Key', 'Role'] });
  for (const item of items) {
    table.push([String(item.id), item.key_name, item.access_key, item.role]);
  }
  return table.toString();
}
