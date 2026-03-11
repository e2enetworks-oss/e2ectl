import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  NodeCatalogOsData,
  NodeCatalogOsEntry,
  NodeCatalogPlan,
  NodeCreateResult,
  NodeDetails,
  NodeSummary
} from './types.js';
import type { NodeCommandResult } from './service.js';

export function renderNodeResult(
  result: NodeCommandResult,
  json: boolean
): string {
  return json ? renderNodeJson(result) : renderNodeHuman(result);
}

export function formatNodesTable(nodes: NodeSummary[]): string {
  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Plan', 'Public IP', 'Private IP']
  });

  for (const node of nodes) {
    table.push([
      String(node.id),
      node.name,
      node.status,
      node.plan,
      node.public_ip_address ?? '',
      node.private_ip_address ?? ''
    ]);
  }

  return table.toString();
}

export function summarizeNodeCatalogOs(
  data: NodeCatalogOsData
): NodeCatalogOsEntry[] {
  return data.category_list
    .flatMap((group) =>
      group.version.flatMap((version) =>
        group.category.map((displayCategory) => ({
          category: version.sub_category,
          display_category: displayCategory,
          number_of_domains: version.number_of_domains ?? null,
          os: version.os,
          os_version: version.version,
          software_version: version.software_version ?? ''
        }))
      )
    )
    .sort((left, right) => {
      const leftKey = [
        left.display_category,
        left.category,
        left.os,
        left.os_version,
        left.software_version
      ].join('\u0000');
      const rightKey = [
        right.display_category,
        right.category,
        right.os,
        right.os_version,
        right.software_version
      ].join('\u0000');

      return leftKey.localeCompare(rightKey);
    });
}

export function formatNodeCatalogOsTable(
  entries: NodeCatalogOsEntry[]
): string {
  const showSoftwareVersion = entries.some((entry) =>
    hasVisibleValue(entry.software_version)
  );
  const table = new Table({
    head: showSoftwareVersion
      ? ['Display Category', 'Category', 'OS', 'OS Version', 'Software Version']
      : ['Display Category', 'Category', 'OS', 'OS Version']
  });

  for (const entry of entries) {
    table.push(
      showSoftwareVersion
        ? [
            entry.display_category,
            entry.category,
            entry.os,
            entry.os_version,
            entry.software_version
          ]
        : [entry.display_category, entry.category, entry.os, entry.os_version]
    );
  }

  return table.toString();
}

export function formatNodeCatalogPlansTable(plans: NodeCatalogPlan[]): string {
  const table = new Table({
    head: [
      '#',
      'SKU',
      'Plan',
      'Image',
      'vCPU',
      'RAM',
      'Disk',
      'Price/Month',
      'Available'
    ]
  });

  sortNodeCatalogPlans(plans).forEach((plan, index) => {
    table.push([
      String(index + 1),
      plan.name,
      plan.plan,
      plan.image,
      formatCell(plan.specs?.cpu),
      formatCell(plan.specs?.ram),
      formatCell(plan.specs?.disk_space),
      formatPrice(plan.specs?.price_per_month, plan.currency),
      plan.available_inventory_status === false ? 'no' : 'yes'
    ]);
  });

  return table.toString();
}

export function formatNodeDetails(node: NodeDetails): string {
  const rows: Array<[string, string]> = [
    ['ID', String(node.id)],
    ['Name', node.name],
    ['Status', node.status],
    ['Plan', node.plan],
    ['Public IP', node.public_ip_address ?? ''],
    ['Private IP', node.private_ip_address ?? ''],
    ['Location', node.location ?? ''],
    ['Created At', node.created_at ?? ''],
    ['Disk', node.disk ?? ''],
    ['Memory', node.memory ?? ''],
    ['vCPUs', node.vcpus ?? '']
  ];

  return rows.map(([label, value]) => `${label}: ${value}`).join('\n');
}

export function formatNodeCreateResult(result: NodeCreateResult): string {
  const lines = [
    `Requested: ${result.total_number_of_node_requested}`,
    `Created: ${result.total_number_of_node_created}`
  ];

  if (result.node_create_response.length > 0) {
    lines.push('', formatNodesTable(result.node_create_response));
  }

  return lines.join('\n');
}

function formatCell(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

function formatPrice(
  value: number | undefined,
  currency: string | undefined
): string {
  if (value === undefined) {
    return '';
  }

  return currency === undefined ? String(value) : `${value} ${currency}`;
}

function hasVisibleValue(value: string): boolean {
  return value.trim().length > 0;
}

function renderNodeHuman(result: NodeCommandResult): string {
  switch (result.action) {
    case 'catalog-os': {
      const entries = summarizeNodeCatalogOs(result.catalog);
      if (entries.length === 0) {
        return 'No OS catalog rows found.\n';
      }

      return (
        `${formatNodeCatalogOsTable(entries)}\n\nUse one row with:\n` +
        'e2ectl node catalog plans --display-category <value> --category <value> --os <value> --os-version <value>\n'
      );
    }
    case 'catalog-plans': {
      const plans = sortNodeCatalogPlans(result.plans);
      if (plans.length === 0) {
        return 'No plans found for the selected OS row.\n';
      }

      return (
        `${formatNodeCatalogPlansTable(plans)}\n\nUse the exact plan and image values from a row with:\n` +
        'e2ectl node create --name <name> --plan <plan> --image <image>\n'
      );
    }
    case 'create':
      return `${formatNodeCreateResult(result.result)}\n`;
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted node ${result.node_id}.\n`;
    case 'get':
      return `${formatNodeDetails(result.node)}\n`;
    case 'list':
      return result.response.data.length === 0
        ? 'No nodes found.\n'
        : `${formatNodesTable(result.response.data)}\n`;
  }
}

function renderNodeJson(result: NodeCommandResult): string {
  switch (result.action) {
    case 'catalog-os':
      return renderJson({
        action: 'catalog-os',
        entries: summarizeNodeCatalogOs(result.catalog)
      });
    case 'catalog-plans':
      return renderJson({
        action: 'catalog-plans',
        plans: sortNodeCatalogPlans(result.plans),
        query: result.query
      });
    case 'create':
      return renderJson({
        action: 'create',
        created: result.result.total_number_of_node_created,
        nodes: result.result.node_create_response,
        requested: result.result.total_number_of_node_requested
      });
    case 'delete':
      return renderJson(
        result.cancelled
          ? {
              action: 'delete',
              cancelled: true,
              node_id: result.node_id
            }
          : {
              action: 'delete',
              cancelled: false,
              message: result.message ?? '',
              node_id: result.node_id
            }
      );
    case 'get':
      return renderJson({
        action: 'get',
        node: result.node
      });
    case 'list':
      return renderJson({
        action: 'list',
        nodes: result.response.data,
        total_count: result.response.total_count ?? null,
        total_page_number: result.response.total_page_number ?? null
      });
  }
}

function renderJson(value: unknown): string {
  return `${stableStringify(value as JsonValue)}\n`;
}

function sortNodeCatalogPlans(plans: NodeCatalogPlan[]): NodeCatalogPlan[] {
  return [...plans].sort((left, right) => {
    const leftKey = [
      left.name,
      left.plan,
      left.image,
      left.location ?? '',
      left.specs?.series ?? ''
    ].join('\u0000');
    const rightKey = [
      right.name,
      right.plan,
      right.image,
      right.location ?? '',
      right.specs?.series ?? ''
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
