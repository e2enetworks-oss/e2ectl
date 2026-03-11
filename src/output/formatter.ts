import Table from 'cli-table3';

import type { ConfigFile, ProfileSummary } from '../types/config.js';
import type { NodeDetails, NodeSummary } from '../types/node.js';
import { stableStringify, type JsonValue } from '../utils/json.js';
import { maskSecret } from '../utils/mask.js';

export function formatJson(value: unknown): string {
  return `${stableStringify(value as JsonValue)}\n`;
}

export function summarizeProfiles(config: ConfigFile): ProfileSummary[] {
  return Object.entries(config.profiles)
    .sort(([leftAlias], [rightAlias]) => leftAlias.localeCompare(rightAlias))
    .map(([alias, profile]) => ({
      alias,
      isDefault: config.default === alias,
      api_key: maskSecret(profile.api_key),
      auth_token: maskSecret(profile.auth_token),
      project_id: profile.project_id,
      location: profile.location
    }));
}

export function formatProfilesTable(profiles: ProfileSummary[]): string {
  const table = new Table({
    head: [
      'Alias',
      'Default',
      'API Key',
      'Auth Token',
      'Project ID',
      'Location'
    ]
  });

  for (const profile of profiles) {
    table.push([
      profile.alias,
      profile.isDefault ? 'yes' : '',
      profile.api_key,
      profile.auth_token,
      profile.project_id,
      profile.location
    ]);
  }

  return table.toString();
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
