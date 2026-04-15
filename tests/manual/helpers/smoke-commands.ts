import { setTimeout as delay } from 'node:timers/promises';

import { runBuiltCli } from '../../helpers/process.js';
import type { SmokeEnv } from './smoke-env.js';

export interface NodeGetJson {
  action: 'get';
  node: {
    id: number;
    is_vpc_attached?: boolean;
    public_ip_address?: string | null;
    status: string;
  };
}

interface VolumePlansJson {
  action: 'plans';
  items: Array<{
    available: boolean;
    size_gb: number;
  }>;
}

export interface VolumeGetJson {
  action: 'get';
  volume: {
    id: number;
    status: string;
  };
}

export interface SmokeJsonCommandOptions {
  stdin?: string;
  timeoutMs?: number;
}

export const MANUAL_SMOKE_COMMAND_TIMEOUT_MS = 2 * 60 * 1000;
const NODE_STATUS_TIMEOUT_MS = 10 * 60 * 1000;
const NODE_STATUS_POLL_INTERVAL_MS = 10 * 1000;
const VOLUME_STATUS_TIMEOUT_MS = 10 * 60 * 1000;
const VOLUME_STATUS_POLL_INTERVAL_MS = 10 * 1000;

export async function discoverAvailableVolumeSize(
  smokeEnv: SmokeEnv
): Promise<number> {
  const volumePlans = await runJsonCommand<VolumePlansJson>(
    ['volume', 'plans', '--available-only'],
    smokeEnv
  );
  const size = volumePlans.items[0]?.size_gb;

  if (!Number.isInteger(size)) {
    throw new Error(
      'Expected volume plans to expose at least one available size for manual smoke.'
    );
  }

  return size as number;
}

export async function runJsonCommand<T>(
  args: string[],
  smokeEnv: SmokeEnv,
  options: SmokeJsonCommandOptions = {}
): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: smokeEnv.cliEnv,
    ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
    timeoutMs: options.timeoutMs ?? MANUAL_SMOKE_COMMAND_TIMEOUT_MS
  });

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: e2ectl ${args.join(' ')}`,
        result.stderr.trim().length === 0
          ? 'STDERR: <empty>'
          : `STDERR: ${result.stderr.trim()}`,
        result.stdout.trim().length === 0
          ? 'STDOUT: <empty>'
          : `STDOUT: ${result.stdout.trim()}`
      ].join('\n')
    );
  }

  try {
    return JSON.parse(result.stdout) as T;
  } catch (error: unknown) {
    throw new Error(
      `Command returned invalid JSON for e2ectl ${args.join(' ')}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function waitForNodeReadiness(
  nodeId: number,
  smokeEnv: SmokeEnv,
  options: {
    requirePublicIp: boolean;
  }
): Promise<NodeGetJson> {
  return await waitForNodeStatus(nodeId, smokeEnv, {
    acceptedStatuses: ['Running'],
    description: options.requirePublicIp
      ? 'Running with a public IP'
      : 'Running',
    requirePublicIp: options.requirePublicIp
  });
}

export async function waitForNodeStatus(
  nodeId: number,
  smokeEnv: SmokeEnv,
  options: {
    acceptedStatuses: string[];
    description: string;
    requirePublicIp?: boolean;
    requireMissingPublicIp?: boolean;
  }
): Promise<NodeGetJson> {
  const deadline = Date.now() + NODE_STATUS_TIMEOUT_MS;
  const acceptedStatuses = new Set(
    options.acceptedStatuses.map((status) => normalizeNodeStatus(status))
  );
  let lastNode: NodeGetJson['node'] | undefined;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      const nodeGet = await runJsonCommand<NodeGetJson>(
        ['node', 'get', String(nodeId)],
        smokeEnv
      );
      const normalizedStatus = normalizeNodeStatus(nodeGet.node.status);
      const publicIp = normalizeObservedPublicIp(
        nodeGet.node.public_ip_address
      );
      const hasPublicIp = publicIp !== null;

      lastNode = nodeGet.node;
      lastError = undefined;

      if (
        acceptedStatuses.has(normalizedStatus) &&
        (!options.requirePublicIp || hasPublicIp) &&
        (!options.requireMissingPublicIp || !hasPublicIp)
      ) {
        return nodeGet;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    if (Date.now() < deadline) {
      await delay(NODE_STATUS_POLL_INTERVAL_MS);
    }
  }

  const lastObservedState =
    lastNode === undefined
      ? (lastError?.message ?? 'No successful node get response was observed.')
      : `status=${lastNode.status}, public_ip=${
          normalizeObservedPublicIp(lastNode.public_ip_address) ?? '<missing>'
        }`;

  throw new Error(
    `Timed out waiting for node ${nodeId} to become ${
      options.description
    } within ${Math.round(
      NODE_STATUS_TIMEOUT_MS / 1000
    )} seconds. Last observed state: ${lastObservedState}`
  );
}

export async function waitForVolumeStatus(
  volumeId: number,
  smokeEnv: SmokeEnv,
  options: {
    acceptedStatuses: string[];
    description: string;
  }
): Promise<VolumeGetJson> {
  const deadline = Date.now() + VOLUME_STATUS_TIMEOUT_MS;
  const acceptedStatuses = new Set(
    options.acceptedStatuses.map((status) => normalizeLifecycleStatus(status))
  );
  let lastVolume: VolumeGetJson['volume'] | undefined;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      const volumeGet = await runJsonCommand<VolumeGetJson>(
        ['volume', 'get', String(volumeId)],
        smokeEnv
      );
      const normalizedStatus = normalizeLifecycleStatus(
        volumeGet.volume.status
      );

      lastVolume = volumeGet.volume;
      lastError = undefined;

      if (acceptedStatuses.has(normalizedStatus)) {
        return volumeGet;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    if (Date.now() < deadline) {
      await delay(VOLUME_STATUS_POLL_INTERVAL_MS);
    }
  }

  const lastObservedState =
    lastVolume === undefined
      ? (lastError?.message ??
        'No successful volume get response was observed.')
      : `status=${lastVolume.status}`;

  throw new Error(
    `Timed out waiting for volume ${volumeId} to become ${
      options.description
    } within ${Math.round(
      VOLUME_STATUS_TIMEOUT_MS / 1000
    )} seconds. Last observed state: ${lastObservedState}`
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function normalizeNodeStatus(status: string): string {
  return normalizeLifecycleStatus(status);
}

export function normalizeObservedPublicIp(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized === '[]' ||
    normalized.toLowerCase() === 'null'
  ) {
    return null;
  }

  return normalized;
}

function normalizeLifecycleStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
