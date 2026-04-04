import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  ReservedIpAttachmentNodeItem,
  ReservedIpCommandResult,
  ReservedIpItem
} from './service.js';

export function renderReservedIpResult(
  result: ReservedIpCommandResult,
  json: boolean
): string {
  return json ? renderReservedIpJson(result) : renderReservedIpHuman(result);
}

export function formatReservedIpListTable(items: ReservedIpItem[]): string {
  const table = new Table({
    head: ['IP Address', 'Status', 'Attached VM', 'Type', 'Project']
  });

  sortReservedIpItems(items).forEach((item) => {
    table.push([
      item.ip_address,
      item.status ?? '--',
      formatAttachedVm(item),
      formatReservedIpType(item),
      item.project_name ?? '--'
    ]);
  });

  return table.toString();
}

function formatReservedIpAttachmentTable(
  items: ReservedIpAttachmentNodeItem[]
): string {
  const table = new Table({
    head: ['Node ID', 'VM ID', 'Name', 'Private IP', 'Public IP', 'Status']
  });

  sortReservedIpAttachmentNodes(items).forEach((item) => {
    table.push([
      item.id === null ? '--' : String(item.id),
      item.vm_id === null ? '--' : String(item.vm_id),
      item.name ?? '--',
      item.ip_address_private ?? '--',
      item.ip_address_public ?? '--',
      item.status_name ?? '--'
    ]);
  });

  return table.toString();
}

function renderReservedIpHuman(result: ReservedIpCommandResult): string {
  switch (result.action) {
    case 'attach-node':
      return (
        `Attached reserved IP ${result.reserved_ip.ip_address} to node ${result.node_id}.\n` +
        `Status: ${result.reserved_ip.status ?? '--'}\n` +
        `Attached VM: ${result.reserved_ip.vm_name ?? '--'}\n` +
        `Message: ${result.message}\n`
      );
    case 'create':
      return (
        `Created reserved IP: ${result.reserved_ip.ip_address}\n` +
        `Status: ${result.reserved_ip.status ?? '--'}\n` +
        `Type: ${formatReservedIpType(result.reserved_ip)}\n` +
        `Project: ${result.reserved_ip.project_name ?? '--'}\n` +
        `Reserve ID: ${result.reserved_ip.reserve_id ?? '--'}\n` +
        '\n' +
        `Next: run ${formatCliCommand('reserved-ip list')} to inspect the current state.\n`
      );
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted reserved IP ${result.ip_address}.\nMessage: ${result.message ?? ''}\n`;
    case 'detach-node':
      return (
        `Detached reserved IP ${result.reserved_ip.ip_address} from node ${result.node_id}.\n` +
        `Status: ${result.reserved_ip.status ?? '--'}\n` +
        `Attached VM: ${result.reserved_ip.vm_name ?? '--'}\n` +
        `Message: ${result.message}\n`
      );
    case 'get': {
      const attachmentSection =
        result.reserved_ip.floating_ip_attached_nodes.length === 0
          ? 'Floating Attached Nodes: none\n'
          : `Floating Attached Nodes (${result.reserved_ip.floating_ip_attached_nodes.length})\n${formatReservedIpAttachmentTable(result.reserved_ip.floating_ip_attached_nodes)}\n`;

      return (
        `Reserved IP: ${result.reserved_ip.ip_address}\n` +
        `Status: ${result.reserved_ip.status ?? '--'}\n` +
        `Attached VM: ${formatAttachedVm(result.reserved_ip)}\n` +
        `Type: ${formatReservedIpType(result.reserved_ip)}\n` +
        `Project: ${result.reserved_ip.project_name ?? '--'}\n` +
        `Bought At: ${result.reserved_ip.bought_at ?? '--'}\n` +
        `Reserve ID: ${result.reserved_ip.reserve_id ?? '--'}\n` +
        `${attachmentSection}`
      );
    }
    case 'list':
      return result.items.length === 0
        ? 'No reserved IPs found.\n'
        : `${formatReservedIpListTable(result.items)}\n`;
  }
}

function renderReservedIpJson(result: ReservedIpCommandResult): string {
  return `${stableStringify(normalizeReservedIpJson(result))}\n`;
}

function normalizeReservedIpJson(result: ReservedIpCommandResult): JsonValue {
  switch (result.action) {
    case 'attach-node':
      return {
        action: 'attach-node',
        message: result.message,
        node_id: result.node_id,
        reserved_ip: normalizeReservedIpActionJson(result.reserved_ip)
      };
    case 'create':
      return {
        action: 'create',
        reserved_ip: normalizeReservedIpItemJson(result.reserved_ip)
      };
    case 'delete':
      return result.cancelled
        ? {
            action: 'delete',
            cancelled: true,
            ip_address: result.ip_address
          }
        : {
            action: 'delete',
            cancelled: false,
            ip_address: result.ip_address,
            message: result.message ?? ''
          };
    case 'detach-node':
      return {
        action: 'detach-node',
        message: result.message,
        node_id: result.node_id,
        reserved_ip: normalizeReservedIpActionJson(result.reserved_ip)
      };
    case 'get':
      return {
        action: 'get',
        reserved_ip: normalizeReservedIpItemJson(result.reserved_ip)
      };
    case 'list':
      return {
        action: 'list',
        items: sortReservedIpItems(result.items).map((item) =>
          normalizeReservedIpItemJson(item)
        )
      };
  }
}

function normalizeReservedIpItemJson(item: ReservedIpItem): JsonValue {
  return {
    appliance_type: item.appliance_type,
    bought_at: item.bought_at,
    floating_ip_attached_nodes: sortReservedIpAttachmentNodes(
      item.floating_ip_attached_nodes
    ).map((attachment) => ({
      id: attachment.id,
      ip_address_private: attachment.ip_address_private,
      ip_address_public: attachment.ip_address_public,
      name: attachment.name,
      security_group_status: attachment.security_group_status,
      status_name: attachment.status_name,
      vm_id: attachment.vm_id
    })),
    ip_address: item.ip_address,
    project_name: item.project_name,
    reserve_id: item.reserve_id,
    reserved_type: item.reserved_type,
    status: item.status,
    vm_id: item.vm_id,
    vm_name: item.vm_name
  };
}

function normalizeReservedIpActionJson(item: {
  ip_address: string;
  status: string | null;
  vm_id: number | null;
  vm_name: string | null;
}): JsonValue {
  return {
    ip_address: item.ip_address,
    status: item.status,
    vm_id: item.vm_id,
    vm_name: item.vm_name
  };
}

function formatAttachedVm(
  item: Pick<ReservedIpItem, 'vm_id' | 'vm_name'>
): string {
  if (item.vm_name !== null && item.vm_id !== null) {
    return `${item.vm_name} (VM ${item.vm_id})`;
  }

  if (item.vm_name !== null) {
    return item.vm_name;
  }

  if (item.vm_id !== null) {
    return `VM ${item.vm_id}`;
  }

  return '--';
}

function formatReservedIpType(
  item: Pick<ReservedIpItem, 'appliance_type' | 'reserved_type'>
): string {
  const values = [item.reserved_type, item.appliance_type].filter(
    (value): value is string => value !== null
  );

  return values.length === 0 ? '--' : values.join(' / ');
}

function sortReservedIpAttachmentNodes(
  items: ReservedIpAttachmentNodeItem[]
): ReservedIpAttachmentNodeItem[] {
  return [...items].sort((left, right) => {
    const leftId = left.id ?? Number.MAX_SAFE_INTEGER;
    const rightId = right.id ?? Number.MAX_SAFE_INTEGER;
    if (leftId !== rightId) {
      return leftId - rightId;
    }

    const leftVmId = left.vm_id ?? Number.MAX_SAFE_INTEGER;
    const rightVmId = right.vm_id ?? Number.MAX_SAFE_INTEGER;
    if (leftVmId !== rightVmId) {
      return leftVmId - rightVmId;
    }

    return (left.name ?? '').localeCompare(right.name ?? '');
  });
}

function sortReservedIpItems(items: ReservedIpItem[]): ReservedIpItem[] {
  return [...items].sort((left, right) => {
    const leftValue = toIpv4Number(left.ip_address);
    const rightValue = toIpv4Number(right.ip_address);

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }

    const leftReserveId = left.reserve_id ?? Number.MAX_SAFE_INTEGER;
    const rightReserveId = right.reserve_id ?? Number.MAX_SAFE_INTEGER;
    return leftReserveId - rightReserveId;
  });
}

function toIpv4Number(address: string): number {
  return address
    .split('.')
    .map((part) => Number(part))
    .reduce((value, octet) => value * 256 + octet, 0);
}
