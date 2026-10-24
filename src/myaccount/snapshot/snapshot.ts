// Shared by node snapshots and volume snapshots: E2E returns both in the
// same shape, so they are shown, checked and worded the same way.
import Table from 'cli-table3';

import { CliError, EXIT_CODES } from '../../core/errors.js';

export interface SnapshotApiItem {
  date?: string;
  is_locked?: boolean;
  name: string;
  snapshot_id?: number | string;
  snapshot_size?: number | string | null;
  snapshot_uuid?: number | string;
  status?: string;
}

// Node snapshots are addressed by snapshot_uuid, volume snapshots by
// snapshot_id; each item's id is the one its own commands take.
export type SnapshotIdField = 'snapshot_id' | 'snapshot_uuid';

export interface SnapshotItem {
  created_at: string;
  id: string;
  locked: boolean;
  name: string;
  size_gb: number | null;
  status: string;
}

export function toSnapshotItem(
  item: SnapshotApiItem,
  idField: SnapshotIdField
): SnapshotItem {
  const size = Number(item.snapshot_size);

  return {
    created_at: item.date ?? '',
    id: String(item[idField] ?? ''),
    locked: item.is_locked === true,
    name: item.name,
    size_gb: item.snapshot_size === null || Number.isNaN(size) ? null : size,
    status: item.status ?? ''
  };
}

export function formatSnapshotTable(items: SnapshotItem[]): string {
  if (items.length === 0) {
    return 'No snapshots found.';
  }

  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Size (GB)', 'Created', 'Locked']
  });
  for (const item of items) {
    table.push([
      item.id,
      item.name,
      item.status,
      item.size_gb === null ? '' : String(item.size_gb),
      item.created_at,
      item.locked ? 'yes' : 'no'
    ]);
  }

  return table.toString();
}

export function normalizeSnapshotId(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  throw new CliError('Snapshot ID must be numeric.', {
    code: 'INVALID_SNAPSHOT_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass the ID column from snapshot list.'
  });
}

export function normalizeSnapshotName(value: string, flag: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  throw new CliError('Name cannot be empty.', {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}
