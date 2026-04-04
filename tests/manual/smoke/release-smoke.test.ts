import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { runBuiltCli, runCommand } from '../../helpers/process.js';
import {
  createSmokeManifest,
  updateSmokeManifest
} from '../helpers/smoke-manifest.js';
import { readSmokeEnv, type SmokeEnv } from '../helpers/smoke-env.js';

interface NodeCreateJson {
  action: 'create';
  nodes: Array<{
    id: number;
  }>;
}

interface NodeGetJson {
  action: 'get';
  node: {
    id: number;
    public_ip_address?: string | null;
    status: string;
  };
}

interface SecurityGroupCreateJson {
  action: 'create';
  security_group: {
    id: number;
  };
}

interface SecurityGroupGetJson {
  action: 'get';
  security_group: {
    id: number;
    rules: unknown[];
  };
}

interface SecurityGroupUpdateJson {
  action: 'update';
  security_group: {
    id: number;
    name: string;
    rule_count: number;
  };
}

interface ReservedIpCreateJson {
  action: 'create';
  reserved_ip: {
    ip_address: string;
  };
}

interface ReservedIpReserveNodeJson {
  action: 'reserve-node';
  ip_address: string;
}

interface ReservedIpGetJson {
  action: 'get';
  reserved_ip: {
    ip_address: string;
  };
}

interface VolumePlansJson {
  action: 'plans';
  items: Array<{
    available: boolean;
    size_gb: number;
  }>;
}

interface VolumeCreateJson {
  action: 'create';
  volume: {
    id: number;
  };
}

interface VolumeGetJson {
  action: 'get';
  volume: {
    id: number;
  };
}

interface VolumeDeleteJson {
  action: 'delete';
  volume_id: number;
}

interface VpcCreateJson {
  action: 'create';
  vpc: {
    id: number;
  };
}

interface VpcGetJson {
  action: 'get';
  vpc: {
    id: number;
  };
}

interface VpcDeleteJson {
  action: 'delete';
  vpc: {
    id: number;
  };
}

interface SshKeyCreateJson {
  action: 'create';
  item: {
    id: number;
  };
}

interface SshKeyGetJson {
  action: 'get';
  item: {
    id: number;
  };
}

interface SshKeyDeleteJson {
  action: 'delete';
  id: number;
}

interface DnsRecordCreateJson {
  action: 'record-create';
  domain_name: string;
  record: {
    name: string;
    type: string;
    value: string;
  };
}

interface DnsRecordListJson {
  action: 'record-list';
  items: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}

interface DnsRecordUpdateJson {
  action: 'record-update';
  record: {
    current_value: string;
    name: string;
    new_value: string;
    type: string;
  };
}

interface DnsRecordDeleteJson {
  action: 'record-delete';
  cancelled: boolean;
}

let smokeEnv: SmokeEnv;

const MANUAL_SMOKE_TEST_TIMEOUT_MS = 30 * 60 * 1000;
const MANUAL_SMOKE_COMMAND_TIMEOUT_MS = 2 * 60 * 1000;
const MANUAL_SMOKE_CLEANUP_TIMEOUT_MS = 10 * 60 * 1000;
const NODE_READY_TIMEOUT_MS = 10 * 60 * 1000;
const NODE_READY_POLL_INTERVAL_MS = 10 * 1000;
const MANUAL_SMOKE_PUBLIC_KEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFJlbGVhc2VTbW9rZUtleUZvckUyRUN0bA release-smoke@e2ectl';

describe('manual release smoke workflow', () => {
  beforeAll(async () => {
    smokeEnv = readSmokeEnv();

    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'exercises destructive release flows through the built CLI',
    { timeout: MANUAL_SMOKE_TEST_TIMEOUT_MS },
    async () => {
      const runPrefix = `${smokeEnv.prefix}-${Date.now().toString(36)}`;
      const nodeName = `${runPrefix}-node`;
      const securityGroupName = `${runPrefix}-sg`;
      const updatedSecurityGroupName = `${securityGroupName}-updated`;
      const volumeName = `${runPrefix}-volume`;
      const vpcName = `${runPrefix}-vpc`;
      const sshKeyLabel = `${runPrefix}-ssh`;
      const dnsRecordHost = runPrefix;
      const initialRecordValue = '203.0.113.10';
      const updatedRecordValue = '203.0.113.11';
      const rulesFilePath = path.resolve(
        process.cwd(),
        '.tmp',
        `${runPrefix}-security-group-rules.json`
      );

      await mkdir(path.dirname(rulesFilePath), {
        recursive: true
      });
      await writeFile(
        rulesFilePath,
        `${JSON.stringify(buildSecurityGroupRules(), null, 2)}\n`,
        'utf8'
      );

      const { path: manifestPath } = await createSmokeManifest({
        dnsDomain: smokeEnv.dnsDomain,
        prefix: runPrefix,
        ...(smokeEnv.manifestPath === undefined
          ? {}
          : {
              manifestPath: smokeEnv.manifestPath
            }),
        tempRulesFilePath: rulesFilePath
      });

      let cleanupError: Error | undefined;
      let workflowError: unknown;

      try {
        const nodeCreate = await runJsonCommand<NodeCreateJson>(
          [
            'node',
            'create',
            '--name',
            nodeName,
            '--plan',
            smokeEnv.nodePlan,
            '--image',
            smokeEnv.nodeImage
          ],
          smokeEnv
        );
        const nodeId = nodeCreate.nodes[0]?.id;

        if (!Number.isInteger(nodeId)) {
          throw new Error(
            'Expected node create to return exactly one node id.'
          );
        }

        const resolvedNodeId = nodeId as number;

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.node_id = resolvedNodeId;
        });

        await waitForNodeReadiness(resolvedNodeId, smokeEnv, {
          requirePublicIp: false
        });

        const securityGroupCreate =
          await runJsonCommand<SecurityGroupCreateJson>(
            [
              'security-group',
              'create',
              '--name',
              securityGroupName,
              '--rules-file',
              rulesFilePath
            ],
            smokeEnv
          );
        const securityGroupId = securityGroupCreate.security_group.id;

        if (!Number.isInteger(securityGroupId)) {
          throw new Error(
            'Expected security-group create to return a security group id.'
          );
        }

        const resolvedSecurityGroupId = securityGroupId;

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.security_group_id = resolvedSecurityGroupId;
        });

        const securityGroupGet = await runJsonCommand<SecurityGroupGetJson>(
          ['security-group', 'get', String(resolvedSecurityGroupId)],
          smokeEnv
        );

        expect(securityGroupGet.security_group.id).toBe(
          resolvedSecurityGroupId
        );
        expect(Array.isArray(securityGroupGet.security_group.rules)).toBe(true);

        const securityGroupUpdate =
          await runJsonCommand<SecurityGroupUpdateJson>(
            [
              'security-group',
              'update',
              String(resolvedSecurityGroupId),
              '--name',
              updatedSecurityGroupName,
              '--description',
              'release smoke update',
              '--rules-file',
              '-'
            ],
            smokeEnv,
            {
              stdin: `${JSON.stringify(buildUpdatedSecurityGroupRules())}\n`
            }
          );

        expect(securityGroupUpdate.security_group.id).toBe(
          resolvedSecurityGroupId
        );
        expect(securityGroupUpdate.security_group.name).toBe(
          updatedSecurityGroupName
        );
        expect(securityGroupUpdate.security_group.rule_count).toBe(
          buildUpdatedSecurityGroupRules().length
        );

        await runJsonCommand(
          [
            'node',
            'action',
            'security-group',
            'attach',
            String(resolvedNodeId),
            '--security-group-id',
            String(resolvedSecurityGroupId)
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.security_group_attached_node_id = resolvedNodeId;
        });

        await runJsonCommand(
          [
            'node',
            'action',
            'security-group',
            'detach',
            String(resolvedNodeId),
            '--security-group-id',
            String(resolvedSecurityGroupId)
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.security_group_attached_node_id = null;
        });

        const addonReservedIpCreate =
          await runJsonCommand<ReservedIpCreateJson>(
            ['reserved-ip', 'create'],
            smokeEnv
          );
        const addonReservedIp = addonReservedIpCreate.reserved_ip.ip_address;

        if (addonReservedIp.length === 0) {
          throw new Error(
            'Expected reserved-ip create to return an IP address.'
          );
        }

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.addon_reserved_ip = addonReservedIp;
        });

        await runJsonCommand(
          [
            'reserved-ip',
            'attach',
            'node',
            addonReservedIp,
            '--node-id',
            String(resolvedNodeId)
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.addon_reserved_ip_attached_node_id = resolvedNodeId;
        });

        await runJsonCommand(
          [
            'reserved-ip',
            'detach',
            'node',
            addonReservedIp,
            '--node-id',
            String(resolvedNodeId)
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.addon_reserved_ip_attached_node_id = null;
        });

        await runJsonCommand(
          ['reserved-ip', 'delete', addonReservedIp, '--force'],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.addon_reserved_ip_deleted = true;
        });

        await waitForNodeReadiness(resolvedNodeId, smokeEnv, {
          requirePublicIp: true
        });

        const preserveNodeIp = await runJsonCommand<ReservedIpReserveNodeJson>(
          ['reserved-ip', 'reserve', 'node', String(resolvedNodeId)],
          smokeEnv
        );
        const preservedReservedIp = preserveNodeIp.ip_address;

        if (preservedReservedIp.length === 0) {
          throw new Error(
            'Expected reserved-ip reserve node to return a preserved IP address.'
          );
        }

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.preserved_reserved_ip = preservedReservedIp;
        });

        await runJsonCommand(
          ['node', 'delete', String(resolvedNodeId), '--force'],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.node_deleted = true;
        });

        const preservedIpGet = await runJsonCommand<ReservedIpGetJson>(
          ['reserved-ip', 'get', preservedReservedIp],
          smokeEnv
        );

        expect(preservedIpGet.reserved_ip.ip_address).toBe(preservedReservedIp);

        await runJsonCommand(
          ['reserved-ip', 'delete', preservedReservedIp, '--force'],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.preserved_reserved_ip_deleted = true;
        });

        const availableVolumeSize = await discoverAvailableVolumeSize(smokeEnv);
        const volumeCreate = await runJsonCommand<VolumeCreateJson>(
          [
            'volume',
            'create',
            '--name',
            volumeName,
            '--size',
            String(availableVolumeSize),
            '--billing-type',
            'hourly'
          ],
          smokeEnv
        );
        const volumeId = volumeCreate.volume.id;

        if (!Number.isInteger(volumeId)) {
          throw new Error('Expected volume create to return a volume id.');
        }

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.volume_id = volumeId;
        });

        const volumeGet = await runJsonCommand<VolumeGetJson>(
          ['volume', 'get', String(volumeId)],
          smokeEnv
        );

        expect(volumeGet.volume.id).toBe(volumeId);

        const volumeDelete = await runJsonCommand<VolumeDeleteJson>(
          ['volume', 'delete', String(volumeId), '--force'],
          smokeEnv
        );

        expect(volumeDelete.volume_id).toBe(volumeId);

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.volume_deleted = true;
        });

        const vpcCreate = await runJsonCommand<VpcCreateJson>(
          [
            'vpc',
            'create',
            '--name',
            vpcName,
            '--billing-type',
            'hourly',
            '--cidr-source',
            'e2e'
          ],
          smokeEnv
        );
        const vpcId = vpcCreate.vpc.id;

        if (!Number.isInteger(vpcId)) {
          throw new Error('Expected vpc create to return a VPC id.');
        }

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.vpc_id = vpcId;
        });

        const vpcGet = await runJsonCommand<VpcGetJson>(
          ['vpc', 'get', String(vpcId)],
          smokeEnv
        );

        expect(vpcGet.vpc.id).toBe(vpcId);

        const vpcDelete = await runJsonCommand<VpcDeleteJson>(
          ['vpc', 'delete', String(vpcId), '--force'],
          smokeEnv
        );

        expect(vpcDelete.vpc.id).toBe(vpcId);

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.vpc_deleted = true;
        });

        const sshKeyCreate = await runJsonCommand<SshKeyCreateJson>(
          [
            'ssh-key',
            'create',
            '--label',
            sshKeyLabel,
            '--public-key-file',
            '-'
          ],
          smokeEnv,
          {
            stdin: `${MANUAL_SMOKE_PUBLIC_KEY}\n`
          }
        );
        const sshKeyId = sshKeyCreate.item.id;

        if (!Number.isInteger(sshKeyId)) {
          throw new Error('Expected ssh-key create to return an SSH key id.');
        }

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.ssh_key_id = sshKeyId;
        });

        const sshKeyGet = await runJsonCommand<SshKeyGetJson>(
          ['ssh-key', 'get', String(sshKeyId)],
          smokeEnv
        );

        expect(sshKeyGet.item.id).toBe(sshKeyId);

        const sshKeyDelete = await runJsonCommand<SshKeyDeleteJson>(
          ['ssh-key', 'delete', String(sshKeyId), '--force'],
          smokeEnv
        );

        expect(sshKeyDelete.id).toBe(sshKeyId);

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.ssh_key_deleted = true;
        });

        const dnsRecordCreate = await runJsonCommand<DnsRecordCreateJson>(
          [
            'dns',
            'record',
            'create',
            smokeEnv.dnsDomain,
            '--type',
            'A',
            '--name',
            dnsRecordHost,
            '--value',
            initialRecordValue,
            '--ttl',
            smokeEnv.recordTtl
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.dns_records = [
            {
              current_value: dnsRecordCreate.record.value,
              deleted: false,
              domain_name: dnsRecordCreate.domain_name,
              name: dnsRecordCreate.record.name,
              type: dnsRecordCreate.record.type
            }
          ];
        });

        const dnsRecordList = await runJsonCommand<DnsRecordListJson>(
          ['dns', 'record', 'list', smokeEnv.dnsDomain],
          smokeEnv
        );

        expect(dnsRecordList.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: dnsRecordCreate.record.name,
              type: dnsRecordCreate.record.type,
              value: initialRecordValue
            })
          ])
        );

        const dnsRecordUpdate = await runJsonCommand<DnsRecordUpdateJson>(
          [
            'dns',
            'record',
            'update',
            smokeEnv.dnsDomain,
            '--type',
            'A',
            '--name',
            dnsRecordHost,
            '--current-value',
            initialRecordValue,
            '--value',
            updatedRecordValue,
            '--ttl',
            smokeEnv.recordTtl
          ],
          smokeEnv
        );

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.dns_records = manifest.dns_records.map((record) =>
            record.name === dnsRecordUpdate.record.name &&
            record.type === dnsRecordUpdate.record.type
              ? {
                  ...record,
                  current_value: dnsRecordUpdate.record.new_value
                }
              : record
          );
        });

        const dnsRecordDelete = await runJsonCommand<DnsRecordDeleteJson>(
          [
            'dns',
            'record',
            'delete',
            smokeEnv.dnsDomain,
            '--type',
            'A',
            '--name',
            dnsRecordHost,
            '--value',
            updatedRecordValue,
            '--force'
          ],
          smokeEnv
        );

        expect(dnsRecordDelete.cancelled).toBe(false);

        await updateSmokeManifest(manifestPath, (manifest) => {
          manifest.dns_records = manifest.dns_records.map((record) =>
            record.name === dnsRecordUpdate.record.name &&
            record.type === dnsRecordUpdate.record.type
              ? {
                  ...record,
                  deleted: true
                }
              : record
          );
        });
      } catch (error: unknown) {
        workflowError = error;
        console.error(`Manual smoke manifest: ${manifestPath}`);
      } finally {
        const cleanupResult = await runCommand(
          process.execPath,
          [
            path.resolve(process.cwd(), 'scripts', 'manual-smoke-cleanup.mjs'),
            '--manifest',
            manifestPath
          ],
          {
            env: smokeEnv.cliEnv,
            timeoutMs: MANUAL_SMOKE_CLEANUP_TIMEOUT_MS
          }
        );

        if (cleanupResult.exitCode !== 0) {
          console.error(`Manual smoke manifest: ${manifestPath}`);
          console.error(cleanupResult.stdout);
          console.error(cleanupResult.stderr);

          if (workflowError === undefined) {
            cleanupError = new Error(
              `Manual smoke cleanup failed for manifest ${manifestPath}.`
            );
          }
        }
      }

      if (workflowError !== undefined) {
        throw toError(workflowError);
      }

      if (cleanupError !== undefined) {
        throw cleanupError;
      }
    }
  );
});

function buildSecurityGroupRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}

function buildUpdatedSecurityGroupRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: 'https',
      network: 'any',
      port_range: '443',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}

async function discoverAvailableVolumeSize(
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

async function runJsonCommand<T>(
  args: string[],
  smokeEnv: SmokeEnv,
  options: {
    stdin?: string;
    timeoutMs?: number;
  } = {}
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

async function waitForNodeReadiness(
  nodeId: number,
  smokeEnv: SmokeEnv,
  options: {
    requirePublicIp: boolean;
  }
): Promise<NodeGetJson> {
  const deadline = Date.now() + NODE_READY_TIMEOUT_MS;
  let lastNode: NodeGetJson['node'] | undefined;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      const nodeGet = await runJsonCommand<NodeGetJson>(
        ['node', 'get', String(nodeId)],
        smokeEnv
      );
      const normalizedStatus = nodeGet.node.status.trim().toLowerCase();
      const publicIp = nodeGet.node.public_ip_address?.trim();

      lastNode = nodeGet.node;
      lastError = undefined;

      if (
        normalizedStatus === 'running' &&
        (!options.requirePublicIp ||
          (publicIp !== undefined && publicIp.length > 0))
      ) {
        return nodeGet;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    if (Date.now() < deadline) {
      await delay(NODE_READY_POLL_INTERVAL_MS);
    }
  }

  const lastObservedState =
    lastNode === undefined
      ? (lastError?.message ?? 'No successful node get response was observed.')
      : `status=${lastNode.status}, public_ip=${
          lastNode.public_ip_address?.trim().length
            ? lastNode.public_ip_address.trim()
            : '<missing>'
        }`;

  throw new Error(
    `Timed out waiting for node ${nodeId} to become ${
      options.requirePublicIp ? 'Running with a public IP' : 'Running'
    } within ${Math.round(
      NODE_READY_TIMEOUT_MS / 1000
    )} seconds. Last observed state: ${lastObservedState}`
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
