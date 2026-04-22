import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type { LoadBalancerBackend, LoadBalancerTcpBackend } from './types.js';
import type {
  LoadBalancerBackendListCommandResult,
  LoadBalancerCommandResult,
  LoadBalancerListCommandResult
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
      return (
        `Created load balancer.\n` +
        `Appliance ID: ${result.result.appliance_id}\n` +
        `ID: ${result.result.id}\n` +
        `\nNext: run ${formatCliCommand('load-balancer list')} to inspect status.\n`
      );

    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted load balancer ${result.lb_id}.\nMessage: ${result.message ?? ''}\n`;

    case 'backend-list':
      return renderBackendListHuman(result);

    case 'backend-add':
      return `${result.message}\n`;
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
          public_ip: item.public_ip ?? null
        }))
      };

    case 'create':
      return {
        action: 'create',
        result: {
          appliance_id: result.result.appliance_id,
          id: result.result.id,
          label_id: result.result.label_id,
          resource_type: result.result.resource_type
        }
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

    case 'backend-list':
      return {
        action: 'backend-list',
        lb_id: result.lb_id,
        lb_mode: result.lb_mode,
        backends: result.backends as unknown as JsonValue,
        tcp_backends: result.tcp_backends as unknown as JsonValue
      };

    case 'backend-add':
      return {
        action: 'backend-add',
        lb_id: result.lb_id,
        message: result.message
      };
  }
}

function formatLoadBalancerListTable(
  items: LoadBalancerListCommandResult['items']
): string {
  const table = new Table({
    head: ['ID', 'Name', 'Status', 'Mode', 'Type', 'Public IP']
  });

  for (const item of items) {
    table.push([
      String(item.id),
      item.appliance_name,
      item.status,
      item.lb_mode ?? '--',
      item.lb_type ?? '--',
      item.public_ip ?? '--'
    ]);
  }

  return table.toString();
}

function renderBackendListHuman(
  result: LoadBalancerBackendListCommandResult
): string {
  const isTcp = result.tcp_backends.length > 0;

  if (!isTcp && result.backends.length === 0) {
    return `No backend groups configured for load balancer ${result.lb_id}.\n`;
  }

  const lines: string[] = [];

  if (isTcp) {
    for (const group of result.tcp_backends) {
      lines.push(formatTcpBackendGroup(group));
    }
  } else {
    for (const group of result.backends) {
      lines.push(formatAlbBackendGroup(group));
    }
  }

  return lines.join('\n') + '\n';
}

function formatAlbBackendGroup(group: LoadBalancerBackend): string {
  const header =
    `Backend Group: ${group.name}\n` +
    `  Domain:    ${group.domain_name || '--'}\n` +
    `  Algorithm: ${group.balance}\n` +
    `  Health:    ${group.http_check ? `enabled (${group.check_url})` : 'disabled'}\n`;

  const serverTable = new Table({
    head: ['Server Name', 'IP', 'Port']
  });

  for (const s of group.servers) {
    serverTable.push([s.backend_name, s.backend_ip, String(s.backend_port)]);
  }

  return header + serverTable.toString();
}

function formatTcpBackendGroup(group: LoadBalancerTcpBackend): string {
  const header =
    `Backend Group: ${group.backend_name}\n` +
    `  Port:      ${group.port}\n` +
    `  Algorithm: ${group.balance}\n`;

  const serverTable = new Table({
    head: ['Server Name', 'IP', 'Port']
  });

  for (const s of group.servers) {
    serverTable.push([s.backend_name, s.backend_ip, String(s.backend_port)]);
  }

  return header + serverTable.toString();
}
