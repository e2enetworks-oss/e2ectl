import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  NodeCatalogBillingType,
  NodeCatalogOsData,
  NodeCatalogOsEntry,
  NodeCatalogPlanItem,
  NodeCatalogPlansQuery,
  NodeCreateResult,
  NodeDetails,
  NodeSummary
} from './types.js';
import type {
  NodeCreateBillingSummary,
  NodeActionStatusSummary,
  NodeCommandResult,
  NodeResolvedSshKeySummary,
  NodeCatalogPlansSummary
} from './service.js';

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

export function formatNodeCatalogPlansTable(
  items: NodeCatalogPlanItem[]
): string {
  const table = new Table({
    head: [
      '#',
      'SKU',
      'Plan',
      'Image',
      'vCPU',
      'RAM',
      'Disk',
      'Hourly',
      'Available'
    ]
  });

  items.forEach((item) => {
    table.push([
      String(item.row),
      item.sku,
      item.plan,
      item.image,
      formatCell(item.config.vcpu),
      formatMemory(item.config.ram),
      formatDisk(item.config.disk_gb, item.config.series),
      formatHourlyPrice(item.hourly.price_per_hour, item.currency),
      item.available_inventory ? 'yes' : 'no'
    ]);
  });

  return table.toString();
}

export function formatNodeCatalogCommittedOptionsTable(
  items: NodeCatalogPlanItem[]
): string {
  const table = new Table({
    head: [
      'Config #',
      'SKU',
      'Config',
      'Committed Plan ID',
      'Term',
      'Total Price'
    ]
  });

  for (const item of items) {
    for (const option of item.committed_options) {
      table.push([
        String(item.row),
        item.sku,
        formatConfigSummary(item),
        String(option.id),
        formatCommittedTerm(option.days),
        formatPrice(option.total_price, item.currency)
      ]);
    }
  }

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

function formatCell(value: number | string | null | undefined): string {
  return value == null ? '' : String(value);
}

function formatConfigSummary(item: NodeCatalogPlanItem): string {
  return [
    formatQuantity(item.config.vcpu, 'vCPU'),
    formatQuantity(trimNumericString(item.config.ram), 'GB'),
    formatDisk(item.config.disk_gb, item.config.series)
  ]
    .filter((part) => part.length > 0)
    .join(' / ');
}

function formatCommittedTerm(days: number | null): string {
  return days === null ? '' : `${days} days`;
}

function formatDisk(
  value: number | null,
  series: string | null | undefined
): string {
  if (value === 0 && isCustomStorageSeries(series)) {
    return 'N/A';
  }

  return formatQuantity(value, 'GB');
}

function formatHourlyPrice(
  value: number | null,
  currency: string | null
): string {
  if (value === null) {
    return '';
  }

  const price = currency === null ? String(value) : `${value} ${currency}`;
  return `${price}/hr`;
}

function formatMemory(value: string | null): string {
  const normalizedValue = trimNumericString(value);
  return normalizedValue === null ? '' : `${normalizedValue} GB`;
}

function formatNodeActionSummary(result: NodeActionStatusSummary): string[] {
  return [
    `Action ID: ${result.action_id}`,
    `Status: ${result.status}`,
    `Created At: ${result.created_at}`,
    ...(result.image_id === null ? [] : [`Image ID: ${result.image_id}`])
  ];
}

function formatPrice(
  value: number | null | undefined,
  currency: string | null | undefined
): string {
  if (value === undefined || value === null) {
    return '';
  }

  return currency == null ? String(value) : `${value} ${currency}`;
}

function formatResolvedSshKeys(keys: NodeResolvedSshKeySummary[]): string {
  return keys.map((key) => `${key.label} (${key.id})`).join(', ');
}

function formatNodeCreateBilling(billing: NodeCreateBillingSummary): string[] {
  return [
    `Billing Type: ${billing.billing_type}`,
    ...(billing.committed_plan_id === undefined
      ? []
      : [`Committed Plan ID: ${billing.committed_plan_id}`]),
    ...(billing.post_commit_behavior === undefined
      ? []
      : [`Post-Commit Behavior: ${billing.post_commit_behavior}`])
  ];
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
        `${formatCliCommand('node catalog plans --display-category <value> --category <value> --os <value> --os-version <value>')}\n`
      );
    }
    case 'catalog-plans': {
      const filterSummary = formatNodeCatalogFilterSummary(result.query);
      const familySummary = formatNodeCatalogFamiliesSummary(
        result.summary,
        result.items
      );
      if (result.items.length === 0) {
        return [
          filterSummary,
          familySummary,
          formatNodeCatalogEmptyMessage(result)
        ]
          .filter((section) => section.length > 0)
          .join('\n\n')
          .concat('\n');
      }

      const sections = [
        filterSummary,
        ...(familySummary.length === 0 ? [] : [familySummary]),
        'Candidate Configs',
        formatNodeCatalogPlansTable(result.items)
      ];

      if (result.query.billing_type !== 'hourly') {
        sections.push(formatCommittedOptionsSection(result.items));
      }

      sections.push(
        formatNodeCatalogCreateExamples(result.items, result.query.billing_type)
      );

      return `${sections.join('\n\n')}\n`;
    }
    case 'create':
      return (
        formatNodeCreateBilling(result.billing)
          .concat('', [formatNodeCreateResult(result.result)])
          .join('\n') + '\n'
      );
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted node ${result.node_id}.\n`;
    case 'get':
      return `${formatNodeDetails(result.node)}\n`;
    case 'list':
      return result.nodes.length === 0
        ? 'No nodes found.\n'
        : `${formatNodesTable(result.nodes)}\n`;
    case 'power-off':
      return (
        [`Requested power off for node ${result.node_id}.`]
          .concat(formatNodeActionSummary(result.result))
          .join('\n') + '\n'
      );
    case 'power-on':
      return (
        [`Requested power on for node ${result.node_id}.`]
          .concat(formatNodeActionSummary(result.result))
          .join('\n') + '\n'
      );
    case 'save-image':
      return (
        [
          `Requested save image for node ${result.node_id} as ${result.image_name}.`
        ]
          .concat(formatNodeActionSummary(result.result))
          .join('\n') + '\n'
      );
    case 'ssh-key-attach':
      return (
        [
          `Requested SSH key attach for node ${result.node_id}.`,
          `SSH Keys: ${formatResolvedSshKeys(result.ssh_keys)}`
        ]
          .concat(formatNodeActionSummary(result.result))
          .join('\n') + '\n'
      );
    case 'volume-attach':
      return (
        [
          `Requested volume attach for node ${result.node_id}.`,
          `Volume ID: ${result.volume.id}`,
          `Message: ${result.result.message}`
        ].join('\n') + '\n'
      );
    case 'volume-detach':
      return (
        [
          `Requested volume detach for node ${result.node_id}.`,
          `Volume ID: ${result.volume.id}`,
          `Message: ${result.result.message}`
        ].join('\n') + '\n'
      );
    case 'vpc-attach': {
      const lines = [
        `Requested VPC attach for node ${result.node_id}.`,
        `VPC ID: ${result.vpc.id}`,
        `VPC Name: ${result.vpc.name}`
      ];

      if (result.vpc.subnet_id !== null) {
        lines.push(`Subnet ID: ${result.vpc.subnet_id}`);
      }

      if (result.vpc.private_ip !== null) {
        lines.push(`Private IP: ${result.vpc.private_ip}`);
      }

      lines.push(`Message: ${result.result.message}`);

      return `${lines.join('\n')}\n`;
    }
    case 'vpc-detach': {
      const lines = [
        `Requested VPC detach for node ${result.node_id}.`,
        `VPC ID: ${result.vpc.id}`,
        `VPC Name: ${result.vpc.name}`
      ];

      if (result.vpc.subnet_id !== null) {
        lines.push(`Subnet ID: ${result.vpc.subnet_id}`);
      }

      if (result.vpc.private_ip !== null) {
        lines.push(`Private IP: ${result.vpc.private_ip}`);
      }

      lines.push(`Message: ${result.result.message}`);

      return `${lines.join('\n')}\n`;
    }
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
        items: result.items.map((item) => ({
          available_inventory: item.available_inventory,
          committed_options: item.committed_options.map((option) => ({
            days: option.days,
            id: option.id,
            name: option.name,
            total_price: option.total_price
          })),
          config: {
            disk_gb: item.config.disk_gb,
            family: item.config.family,
            ram: item.config.ram,
            series: item.config.series,
            vcpu: item.config.vcpu
          },
          currency: item.currency,
          hourly: {
            minimum_billing_amount: item.hourly.minimum_billing_amount,
            price_per_hour: item.hourly.price_per_hour,
            price_per_month: item.hourly.price_per_month
          },
          image: item.image,
          plan: item.plan,
          row: item.row,
          sku: item.sku
        })),
        query: result.query
      });
    case 'create':
      return renderJson({
        action: 'create',
        billing: {
          billing_type: result.billing.billing_type,
          ...(result.billing.committed_plan_id === undefined
            ? {}
            : {
                committed_plan_id: result.billing.committed_plan_id
              }),
          ...(result.billing.post_commit_behavior === undefined
            ? {}
            : {
                post_commit_behavior: result.billing.post_commit_behavior
              })
        },
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
        nodes: result.nodes,
        total_count: result.total_count ?? null,
        total_page_number: result.total_page_number ?? null
      });
    case 'power-off':
      return renderJson({
        action: 'power-off',
        node_id: result.node_id,
        result: normalizeNodeActionJson(result.result)
      });
    case 'power-on':
      return renderJson({
        action: 'power-on',
        node_id: result.node_id,
        result: normalizeNodeActionJson(result.result)
      });
    case 'save-image':
      return renderJson({
        action: 'save-image',
        image_name: result.image_name,
        node_id: result.node_id,
        result: normalizeNodeActionJson(result.result)
      });
    case 'ssh-key-attach':
      return renderJson({
        action: 'ssh-key-attach',
        node_id: result.node_id,
        result: normalizeNodeActionJson(result.result),
        ssh_keys: result.ssh_keys.map((key) => ({
          id: key.id,
          label: key.label
        }))
      });
    case 'volume-attach':
      return renderJson({
        action: 'volume-attach',
        node_id: result.node_id,
        node_vm_id: result.node_vm_id,
        result: {
          message: result.result.message
        },
        volume: {
          id: result.volume.id
        }
      });
    case 'volume-detach':
      return renderJson({
        action: 'volume-detach',
        node_id: result.node_id,
        node_vm_id: result.node_vm_id,
        result: {
          message: result.result.message
        },
        volume: {
          id: result.volume.id
        }
      });
    case 'vpc-attach':
      return renderJson({
        action: 'vpc-attach',
        node_id: result.node_id,
        result: {
          message: result.result.message,
          project_id: result.result.project_id
        },
        vpc: {
          id: result.vpc.id,
          name: result.vpc.name,
          private_ip: result.vpc.private_ip,
          subnet_id: result.vpc.subnet_id
        }
      });
    case 'vpc-detach':
      return renderJson({
        action: 'vpc-detach',
        node_id: result.node_id,
        result: {
          message: result.result.message,
          project_id: result.result.project_id
        },
        vpc: {
          id: result.vpc.id,
          name: result.vpc.name,
          private_ip: result.vpc.private_ip,
          subnet_id: result.vpc.subnet_id
        }
      });
  }
}

function renderJson(value: unknown): string {
  return `${stableStringify(value as JsonValue)}\n`;
}

function normalizeNodeActionJson(result: NodeActionStatusSummary): JsonValue {
  return {
    action_id: result.action_id,
    created_at: result.created_at,
    image_id: result.image_id,
    status: result.status
  };
}

function formatCommittedOptionsSection(items: NodeCatalogPlanItem[]): string {
  const hasCommittedOptions = items.some(
    (item) => item.committed_options.length > 0
  );

  if (!hasCommittedOptions) {
    return 'Committed Options by Config\nNo committed options found for the selected configs.';
  }

  return `Committed Options by Config\n${formatNodeCatalogCommittedOptionsTable(items)}`;
}

function formatNodeCatalogFilterSummary(query: NodeCatalogPlansQuery): string {
  const filters = [
    `OS=${query.os} ${query.osversion}`,
    `Billing=${query.billing_type}`
  ];

  if (query.family !== undefined) {
    filters.push(`Family=${query.family}`);
  }

  return `Filters: ${filters.join(', ')}`;
}

function formatNodeCatalogFamiliesSummary(
  summary: NodeCatalogPlansSummary | undefined,
  items: NodeCatalogPlanItem[]
): string {
  const availableFamilies =
    summary?.available_families ?? collectVisibleFamiliesFromItems(items);

  return availableFamilies.length === 0
    ? ''
    : `Available Families: ${availableFamilies.join(', ')}`;
}

function formatNodeCatalogEmptyMessage(
  result: Extract<NodeCommandResult, { action: 'catalog-plans' }>
): string {
  const emptyReason = result.summary?.empty_reason;

  switch (emptyReason) {
    case 'no_committed':
      return 'No committed plan options found for the selected OS row.';
    case 'no_committed_for_family':
      return `No committed plan options found for family ${result.query.family}.`;
    case 'no_family_match':
      return `No configs were found for family ${result.query.family}.`;
    case 'no_plans':
      return 'No plans found for the selected OS row.';
    default:
      return formatFallbackNodeCatalogEmptyMessage(result.query);
  }
}

function formatNodeCatalogCreateExamples(
  items: NodeCatalogPlanItem[],
  billingType: NodeCatalogBillingType
): string {
  const committedExample = findCommittedCreateExample(items);
  const hourlyExampleItem = committedExample?.item ?? items[0]!;
  const exampleLines = [
    `Create hourly from config #${hourlyExampleItem.row}:`,
    buildHourlyCreateExample(hourlyExampleItem)
  ];

  if (billingType !== 'hourly') {
    if (committedExample === undefined) {
      exampleLines.push(
        '',
        'Committed create example unavailable because the selected configs returned no committed options.'
      );
    } else {
      exampleLines.push(
        '',
        `Create committed from config #${committedExample.item.row}:`,
        buildCommittedCreateExample(
          committedExample.item,
          committedExample.option.id
        )
      );
    }
  }

  return exampleLines.join('\n');
}

function findCommittedCreateExample(items: NodeCatalogPlanItem[]):
  | {
      item: NodeCatalogPlanItem;
      option: NodeCatalogPlanItem['committed_options'][number];
    }
  | undefined {
  for (const item of items) {
    const option = item.committed_options[0];
    if (option !== undefined) {
      return { item, option };
    }
  }

  return undefined;
}

function buildHourlyCreateExample(item: NodeCatalogPlanItem): string {
  return formatCliCommand(
    `node create --name <name> --plan ${item.plan} --image ${item.image}`
  );
}

function buildCommittedCreateExample(
  item: NodeCatalogPlanItem,
  committedPlanId: number
): string {
  return (
    `${formatCliCommand(`node create --name <name> --plan ${item.plan} --image ${item.image}`)} ` +
    `--billing-type committed --committed-plan-id ${committedPlanId}`
  );
}

function formatQuantity(value: number | string | null, unit: string): string {
  if (value === null) {
    return '';
  }

  return `${value} ${unit}`;
}

function trimNumericString(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = Number.parseFloat(value);
  return Number.isFinite(normalizedValue) ? normalizedValue.toString() : value;
}

function isCustomStorageSeries(series: string | null | undefined): boolean {
  return series === 'E1' || series === 'E1WC';
}

function collectVisibleFamiliesFromItems(
  items: NodeCatalogPlanItem[]
): string[] {
  return [...new Set(items.map((item) => item.config.family))]
    .filter((family): family is string => family !== null)
    .sort((left, right) => left.localeCompare(right));
}

function formatFallbackNodeCatalogEmptyMessage(
  query: NodeCatalogPlansQuery
): string {
  if (query.family !== undefined) {
    return `No configs were found for family ${query.family}.`;
  }

  return query.billing_type === 'committed'
    ? 'No committed plan options found for the selected OS row.'
    : 'No plans found for the selected OS row.';
}
