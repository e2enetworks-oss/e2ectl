import { buildTable } from '../../core/table.js';

import { stableStringify, type JsonValue } from '../../core/json.js';
import { formatTirCommand } from '../api.js';
import type { TirImageCommandResult } from './types.js';

export function renderTirImageResult(
  result: TirImageCommandResult,
  json: boolean
): string {
  if (json) {
    return `${stableStringify(result as unknown as JsonValue)}\n`;
  }

  if (result.items.length === 0) {
    return 'No TIR images found.\n';
  }

  const table = buildTable({
    head: ['Version ID', 'Image', 'Version', 'App']
  });
  for (const item of result.items) {
    table.push([
      String(item.version_id),
      item.image_name,
      item.version,
      item.app
    ]);
  }

  return `${table.toString()}\nNext: ${formatTirCommand('plan list --image-version-id <version-id>')}\n`;
}
