import { buildTable } from '../../core/table.js';

import { stableStringify, type JsonValue } from '../../core/json.js';
import { formatTirCommand } from '../api.js';
import type { TirAccountCommandResult } from './types.js';

export function renderTirAccountResult(
  result: TirAccountCommandResult,
  json: boolean
): string {
  if (json) {
    return `${stableStringify(result as unknown as JsonValue)}\n`;
  }

  if (result.items.length === 0) {
    return 'No TIR accounts found for this key.\n';
  }

  const table = buildTable({
    head: ['ID', 'Account', 'Name', 'Role', 'TIR Access']
  });
  for (const item of result.items) {
    table.push([
      String(item.id),
      item.email,
      item.name,
      item.role,
      item.tir_access ? 'yes' : 'no'
    ]);
  }

  return `${table.toString()}\nNext: ${formatTirCommand('project list --account-id <id>')}\n`;
}
