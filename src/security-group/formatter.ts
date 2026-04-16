import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  SecurityGroupCommandResult,
  SecurityGroupItem,
  SecurityGroupRuleItem
} from './service.js';

export function renderSecurityGroupResult(
  result: SecurityGroupCommandResult,
  json: boolean
): string {
  return json
    ? `${stableStringify(normalizeSecurityGroupJson(result))}\n`
    : renderSecurityGroupHuman(result);
}

export function formatSecurityGroupListTable(
  items: SecurityGroupItem[]
): string {
  const table = new Table({
    head: ['ID', 'Name', 'Default', 'Rules', 'Description']
  });

  sortSecurityGroups(items).forEach((item) => {
    table.push([
      String(item.id),
      item.name,
      item.is_default ? 'yes' : 'no',
      String(item.rules.length),
      item.description
    ]);
  });

  return table.toString();
}

export function formatSecurityGroupRuleTable(
  rules: SecurityGroupRuleItem[]
): string {
  const table = new Table({
    head: [
      'ID',
      'Type',
      'Protocol',
      'Ports',
      'Network',
      'CIDR',
      'Size',
      'Description'
    ]
  });

  sortSecurityGroupRules(rules).forEach((rule) => {
    table.push([
      rule.id === null ? '' : String(rule.id),
      rule.rule_type,
      rule.protocol_name,
      rule.port_range,
      rule.network,
      rule.network_cidr,
      rule.network_size === null ? '' : String(rule.network_size),
      rule.description
    ]);
  });

  return table.toString();
}

function formatSecurityGroupDetails(item: SecurityGroupItem): string {
  const lines = [
    `ID: ${item.id}`,
    `Name: ${item.name}`,
    `Default: ${item.is_default ? 'yes' : 'no'}`,
    `All Traffic Rule: ${item.is_all_traffic_rule ? 'yes' : 'no'}`,
    `Description: ${item.description}`
  ];

  if (item.rules.length === 0) {
    lines.push('', 'Rules', 'No rules found.');
  } else {
    lines.push('', 'Rules', formatSecurityGroupRuleTable(item.rules));
  }

  return lines.join('\n');
}

function normalizeSecurityGroupJson(
  result: SecurityGroupCommandResult
): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        message: result.message,
        security_group: {
          description: result.security_group.description,
          id: result.security_group.id,
          is_default: result.security_group.is_default,
          label_id: result.security_group.label_id,
          name: result.security_group.name,
          resource_type: result.security_group.resource_type,
          rule_count: result.security_group.rule_count
        }
      };
    case 'delete':
      return result.cancelled
        ? {
            action: 'delete',
            cancelled: true,
            security_group: {
              id: result.security_group.id,
              name: result.security_group.name
            }
          }
        : {
            action: 'delete',
            cancelled: false,
            message: result.message ?? '',
            security_group: {
              id: result.security_group.id,
              name: result.security_group.name
            }
          };
    case 'get':
      return {
        action: 'get',
        security_group: normalizeSecurityGroupJsonItem(result.security_group)
      };
    case 'list':
      return {
        action: 'list',
        items: sortSecurityGroups(result.items).map((item) =>
          normalizeSecurityGroupJsonItem(item)
        )
      };
    case 'update':
      return {
        action: 'update',
        message: result.message,
        security_group: {
          description: result.security_group.description,
          id: result.security_group.id,
          name: result.security_group.name,
          rule_count: result.security_group.rule_count
        }
      };
  }
}

function normalizeSecurityGroupJsonItem(item: SecurityGroupItem): JsonValue {
  return {
    description: item.description,
    id: item.id,
    is_all_traffic_rule: item.is_all_traffic_rule,
    is_default: item.is_default,
    name: item.name,
    rules: sortSecurityGroupRules(item.rules).map((rule) =>
      normalizeSecurityGroupRuleJsonItem(rule)
    )
  };
}

function normalizeSecurityGroupRuleJsonItem(
  rule: SecurityGroupRuleItem
): JsonValue {
  return {
    description: rule.description,
    id: rule.id,
    network: rule.network,
    network_cidr: rule.network_cidr,
    network_size: rule.network_size,
    port_range: rule.port_range,
    protocol_name: rule.protocol_name,
    rule_type: rule.rule_type,
    vpc_id: rule.vpc_id
  };
}

function renderSecurityGroupHuman(result: SecurityGroupCommandResult): string {
  switch (result.action) {
    case 'create':
      return (
        `Created security group: ${result.security_group.name}\n` +
        `ID: ${result.security_group.id}\n` +
        `Default: ${result.security_group.is_default ? 'yes' : 'no'}\n` +
        `Rules: ${result.security_group.rule_count}\n` +
        `Message: ${result.message}\n` +
        '\n' +
        `Next: run ${formatCliCommand('security-group list')} to inspect the saved security groups.\n`
      );
    case 'delete':
      return result.cancelled
        ? 'Deletion cancelled.\n'
        : `Deleted security group ${result.security_group.id}.\nMessage: ${result.message ?? ''}\n`;
    case 'get':
      return `${formatSecurityGroupDetails(result.security_group)}\n`;
    case 'list':
      return result.items.length === 0
        ? 'No security groups found.\n'
        : `${formatSecurityGroupListTable(result.items)}\n`;
    case 'update':
      return (
        `Updated security group ${result.security_group.id}.\n` +
        `Name: ${result.security_group.name}\n` +
        `Rules: ${result.security_group.rule_count}\n` +
        `Message: ${result.message}\n`
      );
  }
}

function sortSecurityGroupRules(
  rules: SecurityGroupRuleItem[]
): SecurityGroupRuleItem[] {
  return [...rules].sort((left, right) => {
    const leftKey = [
      left.rule_type.toLowerCase(),
      left.protocol_name.toLowerCase(),
      left.port_range,
      left.network.toLowerCase(),
      left.network_cidr,
      left.id === null ? '' : String(left.id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      right.rule_type.toLowerCase(),
      right.protocol_name.toLowerCase(),
      right.port_range,
      right.network.toLowerCase(),
      right.network_cidr,
      right.id === null ? '' : String(right.id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}

function sortSecurityGroups(items: SecurityGroupItem[]): SecurityGroupItem[] {
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
