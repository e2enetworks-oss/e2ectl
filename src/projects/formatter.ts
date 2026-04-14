import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  ProjectCommandResult,
  ProjectItem
} from './service.js';

export function renderProjectResult(
  result: ProjectCommandResult,
  json: boolean
): string {
  return json ? renderProjectJson(result) : renderProjectHuman(result);
}

export function formatProjectTable(items: ProjectItem[]): string {
  const table = new Table({
    head: ['Name', 'ID', 'Default', 'Starred']
  });

  sortProjectItems(items).forEach((item) => {
    table.push([
      item.name,
      String(item.project_id),
      item.is_default ? 'yes' : 'no',
      item.is_starred ? 'yes' : 'no'
    ]);
  });

  return table.toString();
}

function renderProjectHuman(result: ProjectCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Created project: ${result.name}\n` +
        `ID: ${result.project_id}\n`
      );
    case 'list':
      return result.items.length === 0
        ? 'No projects found.\n'
        : `${formatProjectTable(result.items)}\n`;
  }
}

function renderProjectJson(result: ProjectCommandResult): string {
  return `${stableStringify(normalizeJsonResult(result))}\n`;
}

function normalizeJsonResult(result: ProjectCommandResult): JsonValue {
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
          normalizeJsonItem(item)
        )
      };
  }
}

function normalizeJsonItem(item: ProjectItem): JsonValue {
  return {
    is_default: item.is_default,
    is_starred: item.is_starred,
    name: item.name,
    project_id: item.project_id
  };
}

function sortProjectItems(items: ProjectItem[]): ProjectItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      left.name.toLowerCase(),
      String(left.project_id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      right.name.toLowerCase(),
      String(right.project_id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
