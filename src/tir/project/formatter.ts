import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../../core/json.js';
import { formatTirCommand } from '../api.js';
import type {
  TirProjectCommandResult,
  TirProjectListCommandResult
} from './types.js';

export function renderTirProjectResult(
  result: TirProjectCommandResult,
  json: boolean
): string {
  if (json) {
    return `${stableStringify(result as unknown as JsonValue)}\n`;
  }

  return renderProjectList(result);
}

function renderProjectList(result: TirProjectListCommandResult): string {
  if (result.items.length === 0) {
    return `No projects found in TIR account ${result.account_id}.\n`;
  }

  const table = new Table({ head: ['ID', 'Name', 'Created'] });
  for (const item of result.items) {
    table.push([String(item.id), item.name, item.created_at]);
  }

  return `${table.toString()}\nNext: ${formatTirCommand(`configure --account-id ${result.account_id} --project-id <id> --location <Delhi|Chennai>`)}\n`;
}
