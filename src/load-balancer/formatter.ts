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
      if (result.items.length === 0) {
        return (
          'No load balancers found.\n' +
          hint(
            'Run "e2ectl lb plans" to see available plans, then "e2ectl lb create" to create one.'
          )
        );
      }
      return (
        `${formatLoadBalancerListTable(result.items)}\n` +
        hint('Run "e2ectl lb get <id>" to see full details of a load balancer.')
      );

    case 'create':
      return renderLoadBalancerCreateHuman(result);

    case 'get':
      return renderLoadBalancerGetHuman(result);

    case 'delete':
      if (result.cancelled) return 'Deletion cancelled.\n';
      return (
        `Load balancer deleted.\n${formatFieldTable([['Load Balancer ID', result.lb_id]])}\n` +
        hint('Run "e2ectl lb list" to see your remaining load balancers.')
      );

    case 'update': {
      const updateRows: Array<[string, string]> = [
        ['Load Balancer ID', result.lb_id],
        ['Name', result.lb_name]
      ];
      if (result.changes.name !== undefined)
        updateRows.push(['New Name', result.changes.name]);
      if (result.changes.protocol !== undefined)
        updateRows.push(['Protocol', result.changes.protocol]);
      if (result.changes.ssl_certificate_id !== undefined)
        updateRows.push([
          'SSL Certificate ID',
          String(result.changes.ssl_certificate_id)
        ]);
      if (result.changes.redirect_http_to_https !== undefined)
        updateRows.push([
          'HTTP→HTTPS Redirect',
          result.changes.redirect_http_to_https ? 'enabled' : 'disabled'
        ]);
      return (
        `${result.message}\n${formatFieldTable(updateRows)}\n` +
        hint(
          `Run "e2ectl lb get ${result.lb_id}" to view the updated configuration.`
        )
      );
    }

    case 'backend-group-list':
      return renderBackendGroupListHuman(result);

    case 'backend-group-add':
      return renderBackendGroupCreateHuman(result);

    case 'backend-group-update': {
      const bgUpdateRows: Array<[string, string]> = [
        ['Load Balancer ID', result.lb_id],
        ['Name', result.lb_name],
        ['Backend Group', result.group_name]
      ];
      if (result.algorithm !== undefined)
        bgUpdateRows.push(['Algorithm', result.algorithm]);
      if (result.backend_protocol !== undefined)
        bgUpdateRows.push(['Backend Protocol', result.backend_protocol]);
      return (
        `${result.message}\n${formatFieldTable(bgUpdateRows)}\n` +
        hint(
          `Run "e2ectl lb get ${result.lb_id}" to view the updated configuration.`
        )
      );
    }

    case 'backend-group-remove':
      return (
        `${result.message}\n${formatFieldTable([
          ['Load Balancer ID', result.lb_id],
          ['Name', result.lb_name],
          ['Backend Group', result.group_name]
        ])}\n` +
        hint(
          `Run "e2ectl lb backend-group add ${result.lb_id} --name <group> --backend-server <name:ip:port>" to add a new group.`
        )
      );

    case 'backend-server-add':
      return (
        `${result.message}\n${formatFieldTable([
          ['Load Balancer ID', result.lb_id],
          ['Name', result.lb_name],
          ['Backend Group', result.group_name],
          ['Server', result.server_name]
        ])}\n` +
        hint(
          `Run "e2ectl lb get ${result.lb_id}" to view the updated server list.`
        )
      );

    case 'backend-server-update': {
      const bsUpdateRows: Array<[string, string]> = [
        ['Load Balancer ID', result.lb_id],
        ['Name', result.lb_name],
        ['Backend Group', result.group_name],
        ['Server', result.server_name]
      ];
      if (result.ip !== undefined) bsUpdateRows.push(['New IP', result.ip]);
      if (result.port !== undefined)
        bsUpdateRows.push(['New Port', result.port]);
      return (
        `${result.message}\n${formatFieldTable(bsUpdateRows)}\n` +
        hint(
          `Run "e2ectl lb get ${result.lb_id}" to view the updated server configuration.`
        )
      );
    }

    case 'backend-server-remove':
      return (
        `${result.message}\n${formatFieldTable([
          ['Load Balancer ID', result.lb_id],
          ['Name', result.lb_name],
          ['Backend Group', result.group_name],
          ['Server', result.server_name]
        ])}\n` +
        hint(
          `Run "e2ectl lb backend-server add ${result.lb_id} --backend-group ${result.group_name} --backend-server <name:ip:port>" to add a replacement server.`
        )
      );

    case 'network-reserve-ip-attach':
    case 'network-reserve-ip-detach':
    case 'network-vpc-attach':
    case 'network-vpc-detach': {
      const netRows: Array<[string, string]> = [
        ['Load Balancer ID', result.lb_id],
        ['Name', result.lb_name]
      ];
      if (result.reserve_ip !== undefined)
        netRows.push(['Reserved IP', result.reserve_ip]);
      if (result.vpc_id !== undefined) netRows.push(['VPC ID', result.vpc_id]);
      if (result.subnet_id !== undefined)
        netRows.push(['Subnet ID', result.subnet_id]);
      return (
        `${result.message}\n${formatFieldTable(netRows)}\n` +
        hint(
          `Run "e2ectl lb get ${result.lb_id}" to verify the network configuration.`
        )
      );
    }

    case 'plans':
      return result.items.length === 0
        ? 'No load balancer plans available.\n'
        : `${formatLoadBalancerPlans(result.items)}\n`;
  }
}

function hint(text: string): string {
  return `\nHint: ${text}\n`;
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
    return (
      `No backend groups configured for load balancer ${result.lb_id}.\n` +
      hint(
        `Run "e2ectl lb backend-group add ${result.lb_id} --name <group> --backend-server <name:ip:port>" to add one.`
      )
    );
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

  return (
    `Load balancer created.\n${formatFieldTable(rows)}\n` +
    hint(
      `Run "e2ectl lb get ${result.result.id}" to view details, or ` +
        `"e2ectl lb backend-group add ${result.result.id} --name <group> --backend-server <name:ip:port>" to add more backend groups.`
    )
  );
}

function renderLoadBalancerGetHuman(
  result: Extract<LoadBalancerCommandResult, { action: 'get' }>
): string {
  const item = result.item;
  const ctx = item.context?.[0];
  const sslCtx = ctx?.ssl_context as
    | { ssl_certificate_id?: number | null; redirect_to_https?: boolean }
    | undefined;

  const basicRows: Array<[string, string]> = [
    ['ID', String(item.id)],
    ['Name', item.appliance_name],
    ['Status', item.status],
    ['Protocol', item.lb_mode ?? '--'],
    ['Type', item.lb_type ?? '--'],
    ['Port', ctx?.lb_port ?? '--'],
    ['Plan', item.node_detail?.plan_name ?? ctx?.plan_name ?? '--'],
    ['Billing', item.node_detail?.billing_type ?? '--'],
    ['Price', item.node_detail?.price ?? '--'],
    ['Created', item.created_at ?? '--']
  ];

  const networkRows: Array<[string, string]> = [
    ['Public IP', item.public_ip ?? '--'],
    ['Private IP', item.private_ip ?? '--']
  ];
  const reservedIp = ctx?.lb_reserve_ip;
  if (reservedIp) networkRows.push(['Reserved IP', String(reservedIp)]);
  const sslId = sslCtx?.ssl_certificate_id;
  if (sslId != null) networkRows.push(['SSL Certificate ID', String(sslId)]);
  if (sslCtx?.redirect_to_https)
    networkRows.push(['HTTP→HTTPS Redirect', 'yes']);
  const vpcList = ctx?.vpc_list ?? [];
  if (vpcList.length > 0) {
    for (const vpc of vpcList) {
      networkRows.push([
        'VPC',
        `${vpc.vpc_name} [ID: ${vpc.network_id}] (${vpc.ipv4_cidr})${vpc.ip ? ` · IP: ${vpc.ip}` : ''}${vpc.subnet_name ? ` · Subnet: ${vpc.subnet_name}` : ''}`
      ]);
    }
  }

  const backends = ctx?.backends ?? [];
  const tcpBackends = ctx?.tcp_backend ?? [];

  let backendSection = '';
  if (backends.length > 0 || tcpBackends.length > 0) {
    const bgTable = new Table({
      head: ['Group', 'Protocol', 'Algorithm', 'Servers']
    });
    for (const bg of backends) {
      bgTable.push([
        bg.name,
        bg.backend_mode ?? 'http',
        bg.balance,
        bg.servers.length === 0
          ? '--'
          : bg.servers
              .map(
                (s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`
              )
              .join('\n')
      ]);
    }
    for (const bg of tcpBackends) {
      bgTable.push([
        bg.backend_name,
        'tcp',
        bg.balance,
        bg.servers.length === 0
          ? '--'
          : bg.servers
              .map(
                (s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`
              )
              .join('\n')
      ]);
    }
    backendSection = `Backend Groups (${backends.length + tcpBackends.length})\n${bgTable.toString()}\n\n`;
  }

  return (
    `Load balancer details.\n${formatFieldTable(basicRows)}\n` +
    `Network\n${formatFieldTable(networkRows)}\n\n` +
    backendSection +
    hint(
      `Run "e2ectl lb update ${item.id} --name <name>" to rename, ` +
        `"e2ectl lb backend-group add ${item.id} --name <group> --backend-server <name:ip:port>" to add a backend group, ` +
        `or "e2ectl lb delete ${item.id}" to delete.`
    )
  );
}

function renderBackendGroupCreateHuman(
  result: LoadBalancerBackendGroupCreateCommandResult
): string {
  const serverSummary = result.group.servers
    .map((s) => `${s.backend_name} (${s.backend_ip}:${s.backend_port})`)
    .join(', ');

  const rows: Array<[string, string]> = [
    ['Load Balancer ID', result.lb_id],
    ['Name', result.lb_name],
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

  return (
    `${result.message}\n${formatFieldTable(rows)}\n` +
    hint(
      `Run "e2ectl lb backend-server add ${result.lb_id} --backend-group ${result.group.name} --backend-server <name:ip:port>" to add more servers.`
    )
  );
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
  const hourlyHint =
    'To create a load balancer (hourly billing):\n' +
    '  e2ectl lb create --name <name> --plan <Plan> --billing-type hourly \\\n' +
    '    --frontend-protocol <protocol> --port <port> \\\n' +
    '    --backend-group <group> --backend-server <name:ip:port>';
  const committedSection = formatLoadBalancerCommittedPlansSection(items);
  const committedHint =
    'To create a load balancer (committed billing):\n' +
    '  e2ectl lb create --name <name> --plan <Plan> --billing-type committed \\\n' +
    '    --committed-plan-id <Plan ID> --post-commit-behavior auto-renew \\\n' +
    '    --frontend-protocol <protocol> --port <port> \\\n' +
    '    --backend-group <group> --backend-server <name:ip:port>';

  return `${basePlansSection}\n${hourlyHint}\n\n${committedSection}\n${committedHint}`;
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
