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
    head: ['ID', 'Name', 'CLI Default', 'Default', 'Starred']
  });

  sortProjectItems(items).forEach((item) => {
    table.push([
      String(item.project_id),
      item.name,
      formatYesNo(item.is_cli_default_project),
      formatYesNo(item.is_default),
      formatYesNo(item.is_starred)
    ]);
  });

  return table.toString();
}

function renderProjectHuman(result: ProjectCommandResult): string {
  switch (result.action) {
    case 'create':
      return `Created project: ${result.name}\nID: ${result.project_id}\n`;
    case 'list':
      return result.items.length === 0
        ? 'No projects found.\n'
        : `${formatProjectListTable(result.items)}\n`;
    case 'star':
      return `Starred project: ${result.name}\nID: ${result.project_id}\n`;
    case 'unstar':
      return `Unstarred project: ${result.name}\nID: ${result.project_id}\n`;
  }
}

function normalizeProjectJson(result: ProjectCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        name: result.name,
        project_id: result.project_id
      };
    case 'list':
      return {
        action: 'list',
        items: sortProjectItems(result.items).map((item) =>
          normalizeProjectItem(item)
        )
      };
    case 'star':
      return {
        action: 'star',
        name: result.name,
        project_id: result.project_id
      };
    case 'unstar':
      return {
        action: 'unstar',
        name: result.name,
        project_id: result.project_id
      };
  }
}

function normalizeProjectItem(item: ProjectItem): JsonValue {
  return {
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
