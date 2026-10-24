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

// Node snapshots are addressed by snapshot_uuid (a UUID), volume snapshots
// by snapshot_id (a number); each item's id is the one its own commands
// take.
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
  // E2E writes the size as text, for example "4.32 GB".
  const size = Number.parseFloat(String(item.snapshot_size));

  return {
    created_at: item.date ?? '',
    id: String(item[idField] ?? ''),
    locked: item.is_locked === true,
    name: item.name,
    size_gb: Number.isFinite(size) ? size : null,
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

// Volume snapshots are addressed by a number, node snapshots by a UUID.
export function normalizeSnapshotId(
  value: string,
  idField: SnapshotIdField
): string {
  const trimmed = value.trim();
  const pattern = idField === 'snapshot_id' ? /^\d+$/ : /^[\w-]+$/;
  if (pattern.test(trimmed)) {
    return trimmed;
  }

  throw new CliError(
    idField === 'snapshot_id'
      ? 'Volume snapshot IDs are numbers.'
      : 'Snapshot ID can only contain letters, digits and dashes.',
    {
      code: 'INVALID_SNAPSHOT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the ID column from snapshot list.'
    }
  );
}
