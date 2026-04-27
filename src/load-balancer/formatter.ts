import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { LoadBalancerCommittedPlan } from './types.js';
import type {
  LoadBalancerBackendGroupCreateCommandResult,
  LoadBalancerBackendGroupListCommandResult,
  LoadBalancerCreateCommandResult,
  LoadBalancerCommandResult,
  LoadBalancerListCommandResult,
  LoadBalancerPlansCommandResult
} from './service.js';

export function renderLoadBalancerResult(
  result: LoadBalancerCommandResult,
  json: boolean
): string {
  return json
    ? renderLoadBalancerJson(result)
    : renderLoadBalancerHuman(result);
}

function renderLoadBalancerHuman(result: LoadBalancerCommandResult): string {
  switch (result.action) {
    case 'list':
      return result.items.length === 0
        ? 'No load balancers found.\n'
        : `${formatLoadBalancerListTable(result.items)}\n`;

    case 'create':
      return renderLoadBalancerCreateHuman(result);

    case 'get':
      return renderLoadBalancerGetHuman(result);

    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Load balancer deleted.\n${formatFieldTable([['Load Balancer ID', result.lb_id]])}\n`;

    case 'update':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id]
      ])}\n`;

    case 'backend-group-list':
      return renderBackendGroupListHuman(result);

    case 'backend-group-add':
      return renderBackendGroupCreateHuman(result);

    case 'backend-group-update':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id],
        ['Backend Group', result.group_name]
      ])}\n`;

    case 'backend-group-remove':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id],
        ['Backend Group', result.group_name]
      ])}\n`;

    case 'backend-server-add':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id],
        ['Backend Group', result.group_name],
        ['Server', result.server_name]
      ])}\n`;

    case 'backend-server-update':
    case 'backend-server-remove':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id],
        ['Backend Group', result.group_name],
        ['Server', result.server_name]
      ])}\n`;

    case 'network-reserve-ip-attach':
    case 'network-reserve-ip-detach':
    case 'network-vpc-attach':
    case 'network-vpc-detach':
      return `${result.message}\n${formatFieldTable([
        ['Load Balancer ID', result.lb_id]
      ])}\n`;

    case 'plans':
      return result.items.length === 0
        ? 'No load balancer plans available.\n'
        : `${formatLoadBalancerPlans(result.items)}\n`;
  }
}

function renderLoadBalancerJson(result: LoadBalancerCommandResult): string {
  return `${stableStringify(normalizeLoadBalancerJson(result))}\n`;
}

function normalizeLoadBalancerJson(
  result: LoadBalancerCommandResult
): JsonValue {
  switch (result.action) {
    case 'list':
      return {
        action: 'list',
        items: result.items.map((item) => ({
          id: item.id,
          appliance_name: item.appliance_name,
          status: item.status,
          lb_mode: item.lb_mode ?? null,
          lb_type: item.lb_type ?? null,
          public_ip: item.public_ip ?? null,
          private_ip: item.private_ip ?? null
        }))
      };

    case 'create':
      return {
        action: 'create',
        backend: {
          backend_port: result.backend.backend_port,
          health_check: result.backend.health_check,
          name: result.backend.name,
          protocol: result.backend.protocol,
          routing_policy: result.backend.routing_policy,
          servers: result.backend.servers as unknown as JsonValue
        },
        billing: {
          committed_plan_id: result.billing.committed_plan_id,
          committed_plan_name: result.billing.committed_plan_name,
          post_commit_behavior: result.billing.post_commit_behavior,
          type: result.billing.type
        },
        requested: {
          frontend_port: result.requested.frontend_port,
          mode: result.requested.mode,
          name: result.requested.name,
          plan_name: result.requested.plan_name,
          type: result.requested.type
        },
        result: {
          appliance_id: result.result.appliance_id,
          id: result.result.id,
          label_id: result.result.label_id,
          resource_type: result.result.resource_type
        }
      };

    case 'get':
      return {
        action: 'get',
        item: result.item as unknown as JsonValue
      };

    case 'delete':
      return result.cancelled
        ? { action: 'delete', cancelled: true, lb_id: result.lb_id }
        : {
            action: 'delete',
            cancelled: false,
            lb_id: result.lb_id,
            message: result.message ?? ''
          };

    case 'update':
      return {
        action: 'update',
        lb_id: result.lb_id,
        message: result.message
      };

    case 'backend-group-list':
      return {
        action: 'backend-group-list',
        lb_id: result.lb_id,
        lb_mode: result.lb_mode,
        backends: result.backends as unknown as JsonValue,
        tcp_backends: result.tcp_backends as unknown as JsonValue
      };

    case 'backend-group-add':
      return {
        action: 'backend-group-add',
        group: {
          backend_port: result.group.backend_port,
          health_check: result.group.health_check,
          name: result.group.name,
          protocol: result.group.protocol,
          routing_policy: result.group.routing_policy,
          servers: result.group.servers as unknown as JsonValue
        },
        lb_id: result.lb_id,
        message: result.message
      };

    case 'backend-group-update':
      return {
        action: 'backend-group-update',
        group_name: result.group_name,
        lb_id: result.lb_id,
        message: result.message
      };

    case 'backend-group-remove':
      return {
        action: 'backend-group-remove',
        group_name: result.group_name,
        lb_id: result.lb_id,
        message: result.message
      };

    case 'backend-server-add':
      return {
        action: 'backend-server-add',
        group_name: result.group_name,
        lb_id: result.lb_id,
        message: result.message,
        server_name: result.server_name
      };

    case 'backend-server-update':
      return {
        action: 'backend-server-update',
        group_name: result.group_name,
        lb_id: result.lb_id,
        message: result.message,
        server_name: result.server_name
      };

    case 'backend-server-remove':
      return {
        action: 'backend-server-remove',
        group_name: result.group_name,
        lb_id: result.lb_id,
        message: result.message,
        server_name: result.server_name
      };

    case 'network-reserve-ip-attach':
    case 'network-reserve-ip-detach':
    case 'network-vpc-attach':
    case 'network-vpc-detach':
      return {
        action: result.action,
        lb_id: result.lb_id,
        message: result.message
      };

    case 'plans':
      return {
        action: 'plans',
        items: result.items.map((item) => ({
          committed_sku: (item.committed_sku ?? []).map((plan) => ({
            committed_days: plan.committed_days ?? null,
            committed_node_message: plan.committed_node_message ?? null,
            committed_sku_id: plan.committed_sku_id,
            committed_sku_name: plan.committed_sku_name,
            committed_sku_price: plan.committed_sku_price,
            committed_upto_date: plan.committed_upto_date ?? null
          })),
          disk: item.disk ?? null,
          hourly: item.hourly ?? null,
          name: item.name,
          price: item.price ?? null,
          ram: item.ram ?? null,
          template_id: item.template_id,
          vcpu: item.vcpu ?? null
        }))
      };
  }
}

function formatLoadBalancerListTable(
  items: LoadBalancerListCommandResult['items']
): string {
  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Mode', 'Type', 'Public IP', 'Private IP']
  });

  for (const item of items) {
    table.push([
      String(item.id),
      item.appliance_name,
      item.status,
      item.lb_mode ?? '--',
      item.lb_type ?? '--',
      item.public_ip ?? '--',
      item.private_ip ?? '--'
    ]);
  }

  return table.toString();
}

function renderBackendGroupListHuman(
  result: LoadBalancerBackendGroupListCommandResult
): string {
  const isTcp = result.tcp_backends.length > 0;

  if (!isTcp && result.backends.length === 0) {
    return `No backend groups configured for load balancer ${result.lb_id}.\n`;
  }

  const table = new Table({
    head: [
      'Backend Group',
      'Routing Policy',
      'Protocol',
      'Health Check',
      'Servers'
    ]
  });

  if (isTcp) {
    for (const g of result.tcp_backends) {
      table.push([
        g.backend_name,
        g.balance,
        'TCP',
        `Port: ${g.port}`,
        formatServerList(g.servers)
      ]);
    }
  } else {
    for (const g of result.backends) {
      table.push([
        g.name,
        g.balance,
        g.backend_ssl ? 'HTTPS' : 'HTTP',
        g.http_check ? 'enabled' : 'disabled',
        formatServerList(g.servers)
      ]);
    }
  }

  return table.toString();
}

function renderLoadBalancerCreateHuman(
  result: LoadBalancerCreateCommandResult
): string {
  const billing =
    result.billing.type === 'committed' && result.billing.committed_plan_name
      ? `Committed (${result.billing.committed_plan_name})`
      : 'Hourly';

  const serverSummary = result.backend.servers
    .map((s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`)
    .join(', ');

  const rows: Array<[string, string]> = [
    ['Load Balancer ID', result.result.id],
    ['Name', result.requested.name],
    ['Mode', result.requested.mode],
    ['Plan', result.requested.plan_name],
    ['Port', String(result.requested.frontend_port)],
    ['Billing', billing],
    ['Backend', result.backend.name]
  ];

  if (serverSummary) {
    rows.push(['Servers', serverSummary]);
  }

  return `Load balancer created.\n${formatFieldTable(rows)}\n`;
}

function renderLoadBalancerGetHuman(
  result: Extract<LoadBalancerCommandResult, { action: 'get' }>
): string {
  const item = result.item;
  const rows: Array<[string, string]> = [
    ['ID', String(item.id)],
    ['Name', item.appliance_name],
    ['Status', item.status],
    ['Mode', item.lb_mode ?? '--'],
    ['Type', item.lb_type ?? '--'],
    ['Public IP', item.public_ip ?? '--'],
    ['Private IP', item.private_ip ?? '--']
  ];
  const context = item.context?.[0];
  const backendCount =
    (context?.backends ?? []).length + (context?.tcp_backend ?? []).length;

  rows.push(['Backend Groups', String(backendCount)]);

  return `Load balancer details.\n${formatFieldTable(rows)}\n`;
}

function renderBackendGroupCreateHuman(
  result: LoadBalancerBackendGroupCreateCommandResult
): string {
  const serverSummary = result.group.servers
    .map((s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`)
    .join(', ');

  const rows: Array<[string, string]> = [
    ['Load Balancer ID', result.lb_id],
    ['Backend Group', result.group.name],
    ['Protocol', result.group.protocol],
    ['Routing Policy', result.group.routing_policy]
  ];

  if (result.group.backend_port !== null) {
    rows.push(['Backend Port', String(result.group.backend_port)]);
  }

  if (serverSummary) {
    rows.push(['Servers', serverSummary]);
  }

  return `${result.message}\n${formatFieldTable(rows)}\n`;
}

function formatServerList(
  servers: { backend_name: string; backend_ip: string; backend_port: number }[]
): string {
  if (servers.length === 0) return '--';
  return servers
    .map((s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`)
    .join('\n');
}

function formatLoadBalancerPlans(
  items: LoadBalancerPlansCommandResult['items']
): string {
  const basePlansSection = `Base Plans\n${formatLoadBalancerBasePlansTable(items)}\n`;
  const committedSection = formatLoadBalancerCommittedPlansSection(items);

  return `${basePlansSection}\n${committedSection}`;
}

function formatLoadBalancerBasePlansTable(
  items: LoadBalancerPlansCommandResult['items']
): string {
  const table = new Table({
    head: ['Plan', 'vCPU', 'RAM (GB)', 'Disk (GB)', 'Price/Hour', 'Price/Month']
  });

  for (const item of items) {
    table.push([
      item.name,
      formatPlanScalar(item.vcpu),
      formatPlanScalar(item.ram),
      formatPlanScalar(item.disk),
      formatPlanPrice(item.hourly),
      formatPlanPrice(item.price)
    ]);
  }

  return table.toString();
}

function formatLoadBalancerCommittedPlansSection(
  items: LoadBalancerPlansCommandResult['items']
): string {
  const committedPlans = items.flatMap((item) =>
    (item.committed_sku ?? []).map((plan) => ({
      basePlanName: item.name,
      plan
    }))
  );

  if (committedPlans.length === 0) {
    return 'Committed Options\nNo committed plans found.\n';
  }

  const table = new Table({
    head: ['Base Plan', 'Plan ID', 'Name', 'Term (Days)', 'Total Price']
  });

  for (const item of committedPlans) {
    table.push([
      item.basePlanName,
      String(item.plan.committed_sku_id),
      item.plan.committed_sku_name,
      formatCommittedPlanDays(item.plan),
      formatPlanPrice(item.plan.committed_sku_price)
    ]);
  }

  return `Committed Options\n${table.toString()}\n`;
}

function formatCommittedPlanDays(plan: LoadBalancerCommittedPlan): string {
  return plan.committed_days === undefined ? '--' : String(plan.committed_days);
}

function formatPlanPrice(value: number | undefined): string {
  if (value === undefined || value < 0) {
    return '--';
  }

  return String(value);
}

function formatPlanScalar(value: number | undefined): string {
  return value === undefined || value < 0 ? '--' : String(value);
}

function formatFieldTable(rows: Array<[string, string]>): string {
  const table = new Table({ head: ['Field', 'Value'] });

  for (const [field, value] of rows) {
    table.push([field, value]);
  }

  return table.toString();
}
