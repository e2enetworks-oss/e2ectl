import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { SshKeyCommandResult, SshKeyItem } from './service.js';

export function renderSshKeyResult(
  result: SshKeyCommandResult,
  json: boolean
): string {
  return json ? renderSshKeyJson(result) : renderSshKeyHuman(result);
}

export function formatSshKeyTable(items: SshKeyItem[]): string {
  const table = new Table({
    head: ['ID', 'Label', 'Type', 'Attached Nodes', 'Created']
  });

  sortSshKeyItems(items).forEach((item) => {
    table.push([
      String(item.id),
      item.label,
      item.type,
      String(item.attached_nodes),
      item.created_at
    ]);
  });

  return table.toString();
}

function renderSshKeyHuman(result: SshKeyCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Added SSH key: ${result.item.label}\n` +
        `ID: ${result.item.id}\n` +
        `Type: ${result.item.type}\n`
      );
    case 'list':
      return result.items.length === 0
        ? 'No SSH keys found.\n'
        : `${formatSshKeyTable(result.items)}\n`;
  }
}

function renderSshKeyJson(result: SshKeyCommandResult): string {
  return `${stableStringify(normalizeJsonResult(result))}\n`;
}

function normalizeJsonResult(result: SshKeyCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        item: normalizeJsonItem(result.item)
      };
    case 'list':
      return {
        action: 'list',
        items: sortSshKeyItems(result.items).map((item) =>
          normalizeJsonItem(item)
        )
      };
  }
}

function normalizeJsonItem(item: SshKeyItem): JsonValue {
  return {
    attached_nodes: item.attached_nodes,
    created_at: item.created_at,
    id: item.id,
    label: item.label,
    project_id: item.project_id,
    project_name: item.project_name,
    public_key: item.public_key,
    type: item.type
  };
}

function sortSshKeyItems(items: SshKeyItem[]): SshKeyItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      left.label.toLowerCase(),
      String(left.id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      right.label.toLowerCase(),
      String(right.id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
