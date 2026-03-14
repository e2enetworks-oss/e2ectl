import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  VolumeCommandResult,
  VolumeCommittedPlanItem,
  VolumeListItem,
  VolumePlanItem,
  VolumePlansCommandResult
} from './service.js';

export function renderVolumeResult(
  result: VolumeCommandResult,
  json: boolean
): string {
  return json ? renderVolumeJson(result) : renderVolumeHuman(result);
}

export function formatVolumeListTable(items: VolumeListItem[]): string {
  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Size', 'Attached To']
  });

  sortVolumeListItems(items).forEach((item) => {
    table.push([
      String(item.id),
      item.name,
      item.status,
      item.size_label ?? '',
      formatAttachment(item)
    ]);
  });

  return table.toString();
}

export function formatVolumePlansTable(items: VolumePlanItem[]): string {
  const table = new Table({
    head: ['Size (GB)', 'IOPS', 'Price/Hour', 'Available']
  });

  sortVolumePlans(items).forEach((item) => {
    table.push([
      String(item.size_gb),
      String(item.iops),
      formatPrice(item.hourly_price, item.currency),
      item.available ? 'yes' : 'no'
    ]);
  });

  return table.toString();
}

export function formatVolumeCommittedPlansTable(
  items: VolumeCommittedPlanItem[]
): string {
  const table = new Table({
    head: ['Plan ID', 'Name', 'Term (Days)', 'Total Price', 'Savings %']
  });

  sortCommittedPlans(items).forEach((item) => {
    table.push([
      String(item.id),
      item.name,
      String(item.term_days),
      String(item.total_price),
      item.savings_percent === null ? '' : String(item.savings_percent)
    ]);
  });

  return table.toString();
}

function formatVolumeCommittedPlanReferenceTable(
  items: VolumeCommittedPlanItem[]
): string {
  const table = new Table({
    head: ['Plan ID', 'Name', 'Term (Days)']
  });

  sortCommittedPlans(items).forEach((item) => {
    table.push([String(item.id), item.name, String(item.term_days)]);
  });

  return table.toString();
}

function renderVolumeHuman(result: VolumeCommandResult): string {
  switch (result.action) {
    case 'create': {
      const committedSummary =
        result.billing.committed_plan === null
          ? ''
          : `\nCommitted Plan: ${result.billing.committed_plan.id} (${result.billing.committed_plan.name})\nCommitted Total: ${result.billing.committed_plan.total_price}`;
      const postCommitSummary =
        result.billing.post_commit_behavior === null
          ? ''
          : `\nPost-Commit: ${result.billing.post_commit_behavior}`;
      const hourlyReference =
        result.resolved_plan.hourly_price === null
          ? ''
          : `\nHourly Price Reference: ${formatPrice(result.resolved_plan.hourly_price, result.resolved_plan.currency)}`;

      return (
        `Created volume: ${result.volume.name}\n` +
        `ID: ${result.volume.id}\n` +
        `Size: ${result.resolved_plan.size_gb} GB\n` +
        `Derived IOPS: ${result.resolved_plan.iops}\n` +
        `Billing: ${result.billing.type}${committedSummary}${postCommitSummary}${hourlyReference}\n` +
        '\n' +
        `Next: run ${formatCliCommand('volume list')} to inspect the current state.\n`
      );
    }
    case 'list':
      return result.items.length === 0
        ? 'No volumes found.\n'
        : `${formatVolumeListTable(result.items)}\n`;
    case 'plans': {
      const sortedItems = sortVolumePlans(result.items);
      const scopeSummary = formatVolumePlansScope(result);

      if (sortedItems.length === 0) {
        const noPlansMessage = result.filters.available_only
          ? 'No available volume plans found.\n'
          : 'No volume plans found.\n';

        return `${scopeSummary}\n${noPlansMessage}`;
      }

      const basePlansSection = `Base Plans (${result.total_count})\n${formatVolumePlansTable(sortedItems)}\n`;
      const committedSection = renderCommittedPlansSection(result, sortedItems);

      return (
        `${scopeSummary}\n${basePlansSection}\n${committedSection}\n` +
        'Create with explicit size and billing:\n' +
        `${formatCliCommand('volume create --name <name> --size <size-gb> --billing-type hourly')}\n` +
        `${formatCliCommand('volume create --name <name> --size <size-gb> --billing-type committed --committed-plan-id <id>')}\n`
      );
    }
  }
}

function renderVolumeJson(result: VolumeCommandResult): string {
  return `${stableStringify(normalizeVolumeJson(result))}\n`;
}

function normalizeVolumeJson(result: VolumeCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        billing: {
          committed_plan:
            result.billing.committed_plan === null
              ? null
              : normalizeCommittedPlanJson(result.billing.committed_plan),
          post_commit_behavior: result.billing.post_commit_behavior,
          type: result.billing.type
        },
        requested: {
          name: result.requested.name,
          size_gb: result.requested.size_gb
        },
        resolved_plan: {
          available: result.resolved_plan.available,
          currency: result.resolved_plan.currency,
          hourly_price: result.resolved_plan.hourly_price,
          iops: result.resolved_plan.iops,
          size_gb: result.resolved_plan.size_gb
        },
        volume: {
          id: result.volume.id,
          name: result.volume.name
        }
      };
    case 'list':
      return {
        action: 'list',
        items: sortVolumeListItems(result.items).map((item) =>
          normalizeVolumeListJson(item)
        ),
        total_count: result.total_count,
        total_page_number: result.total_page_number
      };
    case 'plans':
      return {
        action: 'plans',
        filters: {
          available_only: result.filters.available_only,
          size_gb: result.filters.size_gb
        },
        items: sortVolumePlans(result.items).map((item) => ({
          available: item.available,
          committed_options: sortCommittedPlans(item.committed_options).map(
            (option) => normalizeCommittedPlanJson(option)
          ),
          currency: item.currency,
          hourly_price: item.hourly_price,
          iops: item.iops,
          size_gb: item.size_gb
        })),
        total_count: result.total_count
      };
  }
}

function normalizeVolumeListJson(item: VolumeListItem): JsonValue {
  return {
    attached: item.attached,
    attachment:
      item.attachment === null
        ? null
        : {
            node_id: item.attachment.node_id,
            vm_id: item.attachment.vm_id,
            vm_name: item.attachment.vm_name
          },
    id: item.id,
    name: item.name,
    size_gb: item.size_gb,
    size_label: item.size_label,
    status: item.status
  };
}

function normalizeCommittedPlanJson(item: VolumeCommittedPlanItem): JsonValue {
  return {
    id: item.id,
    name: item.name,
    savings_percent: item.savings_percent,
    term_days: item.term_days,
    total_price: item.total_price
  };
}

function renderCommittedPlansSection(
  result: VolumePlansCommandResult,
  items: VolumePlanItem[]
): string {
  if (items.length === 1) {
    const item = items[0]!;

    return item.committed_options.length === 0
      ? `Committed Options For ${item.size_gb} GB\nNo committed options found.\n`
      : `Committed Options For ${item.size_gb} GB\n${formatVolumeCommittedPlansTable(item.committed_options)}\n`;
  }

  const sharedCommittedPlans = findSharedCommittedPlans(items);
  if (sharedCommittedPlans !== null && sharedCommittedPlans.length > 0) {
    return (
      `Committed Terms\n${formatVolumeCommittedPlanReferenceTable(sharedCommittedPlans)}\n` +
      'Committed totals vary by size. Inspect one size for exact committed pricing:\n' +
      `${formatCliCommand('volume plans --size <size-gb>')}\n`
    );
  }

  if (items.some((item) => item.committed_options.length > 0)) {
    return (
      'Committed Pricing\n' +
      'Committed options vary by size. Inspect one size for exact committed pricing:\n' +
      `${formatCliCommand('volume plans --size <size-gb>')}\n`
    );
  }

  return '';
}

function formatVolumePlansScope(result: VolumePlansCommandResult): string {
  const scopeParts: string[] = [];

  if (result.filters.size_gb !== null) {
    scopeParts.push(`size ${result.filters.size_gb} GB`);
  }

  if (result.filters.available_only) {
    scopeParts.push('available inventory only');
  }

  const suffix = scopeParts.length === 0 ? '' : ` for ${scopeParts.join(', ')}`;
  const rowLabel = result.total_count === 1 ? 'row' : 'rows';

  return `Showing ${result.total_count} plan ${rowLabel}${suffix}.`;
}

function findSharedCommittedPlans(
  items: VolumePlanItem[]
): VolumeCommittedPlanItem[] | null {
  if (items.length === 0) {
    return [];
  }

  const baseline = sortCommittedPlans(items[0]!.committed_options);

  for (const item of items.slice(1)) {
    const current = sortCommittedPlans(item.committed_options);
    if (current.length !== baseline.length) {
      return null;
    }

    const matches = current.every((option, index) => {
      const reference = baseline[index];

      return (
        reference !== undefined &&
        option.id === reference.id &&
        option.name === reference.name &&
        option.term_days === reference.term_days
      );
    });

    if (!matches) {
      return null;
    }
  }

  return baseline;
}

function formatAttachment(item: VolumeListItem): string {
  if (item.attachment === null) {
    return '';
  }

  const label =
    item.attachment.vm_name ?? `vm ${item.attachment.vm_id ?? ''}`.trim();
  if (item.attachment.node_id === null) {
    return label;
  }

  return `${label} (node ${item.attachment.node_id})`;
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value === null) {
    return '';
  }

  return currency === null ? String(value) : `${value} ${currency}`;
}

function sortCommittedPlans(
  items: VolumeCommittedPlanItem[]
): VolumeCommittedPlanItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      String(left.term_days).padStart(5, '0'),
      left.name,
      String(left.id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      String(right.term_days).padStart(5, '0'),
      right.name,
      String(right.id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}

function sortVolumeListItems(items: VolumeListItem[]): VolumeListItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      left.name.toLowerCase(),
      String(left.id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      right.name.toLowerCase(),
      String(right.id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}

function sortVolumePlans(items: VolumePlanItem[]): VolumePlanItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      String(left.size_gb).padStart(8, '0'),
      String(left.iops).padStart(8, '0'),
      left.available ? '1' : '0'
    ].join('\u0000');
    const rightKey = [
      String(right.size_gb).padStart(8, '0'),
      String(right.iops).padStart(8, '0'),
      right.available ? '1' : '0'
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
