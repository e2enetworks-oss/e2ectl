import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { ImageCommandResult, ImageItem } from './service.js';

export function renderImageResult(
  result: ImageCommandResult,
  json: boolean
): string {
  return json ? renderImageJson(result) : renderImageHuman(result);
}

export function formatImageTable(items: ImageItem[]): string {
  const table = new Table({
    head: [
      'ID',
      'Template ID',
      'Name',
      'Size',
      'State',
      'Running VMs',
      'Scale Groups',
      'Created'
    ]
  });

  sortImageItems(items).forEach((item) => {
    table.push([
      item.image_id,
      item.template_id !== null ? String(item.template_id) : '',
      item.image_name,
      item.image_size,
      item.image_state,
      String(item.running_vms),
      String(item.scaler_group_count),
      item.creation_time
    ]);
  });

  return table.toString();
}

function renderImageHuman(result: ImageCommandResult): string {
  switch (result.action) {
    case 'list':
      return result.items.length === 0
        ? 'No saved images found.\n'
        : `${formatImageTable(result.items)}\n`;
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted image ${result.id}.\nMessage: ${result.message ?? ''}\n`;
    case 'rename':
      return `Renamed image ${result.id} to: ${result.name}\nMessage: ${result.message}\n`;
  }
}

function renderImageJson(result: ImageCommandResult): string {
  return `${stableStringify(normalizeJsonResult(result))}\n`;
}

function normalizeJsonResult(result: ImageCommandResult): JsonValue {
  switch (result.action) {
    case 'list':
      return {
        action: 'list',
        items: sortImageItems(result.items).map(normalizeJsonItem)
      };
    case 'delete':
      return result.cancelled
        ? { action: 'delete', cancelled: true, id: result.id }
        : {
            action: 'delete',
            cancelled: false,
            id: result.id,
            message: result.message ?? ''
          };
    case 'rename':
      return {
        action: 'rename',
        id: result.id,
        message: result.message,
        name: result.name
      };
  }
}

function normalizeJsonItem(item: ImageItem): JsonValue {
  return {
    creation_time: item.creation_time,
    image_id: item.image_id,
    image_name: item.image_name,
    image_size: item.image_size,
    image_state: item.image_state,
    is_windows: item.is_windows,
    node_plans_available: item.node_plans_available,
    os_distribution: item.os_distribution,
    project_name: item.project_name,
    running_vms: item.running_vms,
    scaler_group_count: item.scaler_group_count,
    template_id: item.template_id
  };
}

function sortImageItems(items: ImageItem[]): ImageItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      (left.image_name ?? '').toLowerCase(),
      left.image_id.padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      (right.image_name ?? '').toLowerCase(),
      right.image_id.padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
