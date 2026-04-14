import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { ProjectCommandResult, ProjectItem } from './service.js';

export function renderProjectResult(
  result: ProjectCommandResult,
  json: boolean
): string {
  return json
    ? `${stableStringify(normalizeProjectJson(result))}\n`
    : renderProjectHuman(result);
}

export function formatProjectListTable(items: ProjectItem[]): string {
  const table = new Table({
    head: [
      'ID',
      'Name',
      'Role',
      'CLI Default',
      'Backend Active',
      'Default',
      'Starred',
      'Policies',
      'Members'
    ]
  });

  sortProjectItems(items).forEach((item) => {
    table.push([
      String(item.project_id),
      item.name,
      item.current_user_role,
      formatYesNo(item.is_cli_default_project),
      formatYesNo(item.is_backend_active_project),
      formatYesNo(item.is_default),
      formatYesNo(item.is_starred),
      String(item.associated_policy_count),
      String(item.associated_member_count)
    ]);
  });

  return table.toString();
}

function renderProjectHuman(result: ProjectCommandResult): string {
  return result.items.length === 0
    ? 'No projects found.\n'
    : `${formatProjectListTable(result.items)}\n`;
}

function normalizeProjectJson(result: ProjectCommandResult): JsonValue {
  return {
    action: 'list',
    items: sortProjectItems(result.items).map((item) =>
      normalizeProjectItem(item)
    )
  };
}

function normalizeProjectItem(item: ProjectItem): JsonValue {
  return {
    associated_member_count: item.associated_member_count,
    associated_policy_count: item.associated_policy_count,
    current_user_role: item.current_user_role,
    is_backend_active_project: item.is_backend_active_project,
    is_cli_default_project: item.is_cli_default_project,
    is_default: item.is_default,
    is_starred: item.is_starred,
    name: item.name,
    project_id: item.project_id
  };
}

function formatYesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function sortProjectItems(items: ProjectItem[]): ProjectItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      left.name.toLowerCase(),
      String(left.project_id).padStart(12, '0')
    ].join('\u0000');
    const rightKey = [
      right.name.toLowerCase(),
      String(right.project_id).padStart(12, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
