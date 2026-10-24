import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../../core/json.js';
import type { TirPlanCommandResult, TirPlanItem } from './types.js';

export function renderTirPlanResult(
  result: TirPlanCommandResult,
  json: boolean
): string {
  if (json) {
    return `${stableStringify(result as unknown as JsonValue)}\n`;
  }

  if (result.items.length === 0) {
    return 'No TIR plans found.\n';
  }

  const table = new Table({
    head: [
      'Name',
      'Series',
      'vCPU',
      'Memory',
      'GPU',
      'Hourly Plan ID',
      'Price/Hour',
      'Committed Options',
      'Available'
    ]
  });
  for (const item of result.items) {
    table.push([
      item.name,
      item.series,
      item.vcpu === null ? '' : String(item.vcpu),
      item.memory ?? '',
      formatGpu(item.gpu),
      item.hourly === null ? '' : String(item.hourly.plan_id),
      formatPrice(item),
      String(item.committed.length),
      item.available ? 'yes' : 'no'
    ]);
  }

  return `${table.toString()}\nCommitted plan ids and prices are in --json.\n`;
}

function formatGpu(gpu: TirPlanItem['gpu']): string {
  if (gpu === null) {
    return '';
  }

  return gpu.count === null ? gpu.type : `${gpu.count}x ${gpu.type}`;
}

function formatPrice(item: TirPlanItem): string {
  if (item.hourly === null || item.hourly.price === null) {
    return '';
  }

  return `${item.hourly.price} ${item.currency ?? ''}`.trim();
}
