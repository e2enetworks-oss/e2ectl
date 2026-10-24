import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../../core/json.js';
import { formatTirCommand } from '../api.js';
import type {
  TirConfigureCommandResult,
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

  return result.action === 'list'
    ? renderProjectList(result)
    : renderConfigure(result);
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

function renderConfigure(result: TirConfigureCommandResult): string {
  const accountLabel =
    result.account.email.length > 0
      ? `${result.account.id} (${result.account.email})`
      : String(result.account.id);

  return `TIR context saved for profile "${result.alias}": account ${accountLabel}, project ${result.project.id} (${result.project.name}), ${result.location}.\n`;
}
