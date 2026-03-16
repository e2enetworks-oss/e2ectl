import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  VpcCommandResult,
  VpcCommittedPlanItem,
  VpcHourlyPlanItem,
  VpcListItem
} from './service.js';

export function renderVpcResult(
  result: VpcCommandResult,
  json: boolean
): string {
  return json ? renderVpcJson(result) : renderVpcHuman(result);
}

export function formatVpcListTable(items: VpcListItem[]): string {
  const table = new Table({
    head: [
      'Network ID',
      'Name',
      'State',
      'CIDR',
      'Source',
      'Attached VMs',
      'Subnets'
    ]
  });

  sortVpcListItems(items).forEach((item) => {
    table.push([
      String(item.network_id),
      item.name,
      item.state,
      item.cidr,
      item.cidr_source === 'e2e' ? 'E2E' : 'Custom',
      String(item.attached_vm_count),
      String(item.subnet_count)
    ]);
  });

  return table.toString();
}

export function formatVpcHourlyPlansTable(items: VpcHourlyPlanItem[]): string {
  const table = new Table({
    head: ['Plan', 'Location', 'Price/Hour', 'Price/Month']
  });

  sortVpcHourlyPlans(items).forEach((item) => {
    table.push([
      item.name,
      item.location ?? '',
      formatPrice(item.price_per_hour, item.currency),
      formatPrice(item.price_per_month, item.currency)
    ]);
  });

  return table.toString();
}

export function formatVpcCommittedPlansTable(
  items: VpcCommittedPlanItem[]
): string {
  const table = new Table({
    head: ['Plan ID', 'Name', 'Term (Days)', 'Total Price']
  });

  sortVpcCommittedPlans(items).forEach((item) => {
    table.push([
      String(item.id),
      item.name,
      String(item.term_days),
      formatPrice(item.total_price, item.currency)
    ]);
  });

  return table.toString();
}

function formatPrice(
  value: number | null,
  currency: string | null | undefined
): string {
  if (value === null || value === undefined) {
    return '';
  }

  return currency === undefined || currency === null
    ? String(value)
    : `${value} ${currency}`;
}

function renderVpcHuman(result: VpcCommandResult): string {
  switch (result.action) {
    case 'create': {
      const billingSummary =
        result.billing.type === 'committed'
          ? `committed (plan ${result.billing.committed_plan_id}, post-commit: ${result.billing.post_commit_behavior})`
          : 'hourly';
      const cidrSummary =
        result.cidr.source === 'custom'
          ? `custom ${result.cidr.value ?? ''}`.trim()
          : 'E2E-provided';

      return (
        `Created VPC request: ${result.vpc.name}\n` +
        `VPC ID: ${result.vpc.vpc_id}\n` +
        `Network ID: ${result.vpc.network_id}\n` +
        `Billing: ${billingSummary}\n` +
        `CIDR: ${cidrSummary}\n` +
        '\n' +
        `Next: run ${formatCliCommand('vpc list')} to inspect the VPC state.\n`
      );
    }
    case 'list':
      return result.items.length === 0
        ? 'No VPCs found.\n'
        : `${formatVpcListTable(result.items)}\n`;
    case 'plans': {
      const hourlySection =
        result.hourly.items.length === 0
          ? 'Hourly\nNo hourly plans found.\n'
          : `Hourly\n${formatVpcHourlyPlansTable(result.hourly.items)}\n`;
      const committedSection =
        result.committed.items.length === 0
          ? 'Committed\nNo committed plans found.\n'
          : `Committed\n${formatVpcCommittedPlansTable(result.committed.items)}\n`;

      return (
        `${hourlySection}\n${committedSection}\n` +
        'Create with explicit billing and CIDR choices:\n' +
        `${formatCliCommand('vpc create --name <name> --billing-type hourly --cidr-source e2e')}\n` +
        `${formatCliCommand('vpc create --name <name> --billing-type hourly --cidr-source custom --cidr <cidr>')}\n` +
        `${formatCliCommand('vpc create --name <name> --billing-type committed --committed-plan-id <id> --cidr-source e2e')}\n` +
        `${formatCliCommand('vpc create --name <name> --billing-type committed --committed-plan-id <id> --cidr-source custom --cidr <cidr>')}\n`
      );
    }
  }
}

function renderVpcJson(result: VpcCommandResult): string {
  return `${stableStringify(normalizeVpcJson(result))}\n`;
}

function normalizeVpcJson(result: VpcCommandResult): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        billing: {
          committed_plan_id: result.billing.committed_plan_id,
          post_commit_behavior: result.billing.post_commit_behavior,
          type: result.billing.type
        },
        cidr: {
          source: result.cidr.source,
          value: result.cidr.value
        },
        credit_sufficient: result.credit_sufficient,
        vpc: {
          name: result.vpc.name,
          network_id: result.vpc.network_id,
          project_id: result.vpc.project_id,
          vpc_id: result.vpc.vpc_id
        }
      };
    case 'list':
      return {
        action: 'list',
        items: sortVpcListItems(result.items).map((item) =>
          normalizeVpcListJsonItem(item)
        ),
        total_count: result.total_count,
        total_page_number: result.total_page_number
      };
    case 'plans':
      return {
        action: 'plans',
        committed: {
          ...result.committed,
          items: sortVpcCommittedPlans(result.committed.items).map((item) =>
            normalizeVpcCommittedPlanJsonItem(item)
          )
        },
        hourly: {
          items: sortVpcHourlyPlans(result.hourly.items).map((item) =>
            normalizeVpcHourlyPlanJsonItem(item)
          )
        }
      };
  }
}

function normalizeVpcCommittedPlanJsonItem(
  item: VpcCommittedPlanItem
): JsonValue {
  return {
    currency: item.currency,
    id: item.id,
    name: item.name,
    term_days: item.term_days,
    total_price: item.total_price
  };
}

function normalizeVpcHourlyPlanJsonItem(item: VpcHourlyPlanItem): JsonValue {
  return {
    currency: item.currency,
    location: item.location,
    name: item.name,
    price_per_hour: item.price_per_hour,
    price_per_month: item.price_per_month
  };
}

function normalizeVpcListJsonItem(item: VpcListItem): JsonValue {
  return {
    attached_vm_count: item.attached_vm_count,
    cidr: item.cidr,
    cidr_source: item.cidr_source,
    created_at: item.created_at,
    gateway_ip: item.gateway_ip,
    location: item.location,
    name: item.name,
    network_id: item.network_id,
    project_name: item.project_name,
    state: item.state,
    subnet_count: item.subnet_count,
    subnets: item.subnets.map((subnet) => ({
      cidr: subnet.cidr,
      id: subnet.id,
      name: subnet.name,
      total_ips: subnet.total_ips,
      used_ips: subnet.used_ips
    }))
  };
}

function sortVpcCommittedPlans(
  items: VpcCommittedPlanItem[]
): VpcCommittedPlanItem[] {
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

function sortVpcHourlyPlans(items: VpcHourlyPlanItem[]): VpcHourlyPlanItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [left.name, left.location ?? '', left.currency ?? ''].join(
      '\u0000'
    );
    const rightKey = [
      right.name,
      right.location ?? '',
      right.currency ?? ''
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}

function sortVpcListItems(items: VpcListItem[]): VpcListItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [left.name, String(left.network_id).padStart(10, '0')].join(
      '\u0000'
    );
    const rightKey = [
      right.name,
      String(right.network_id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
