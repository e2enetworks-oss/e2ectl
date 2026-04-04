import { access } from 'node:fs/promises';
import path from 'node:path';

import { runBuiltCli } from '../../helpers/process.js';
import { readReadOnlyEnv, type ReadOnlyEnv } from '../helpers/read-only-env.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;

const MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS = 60 * 1000;
const MANUAL_READ_ONLY_TEST_TIMEOUT_MS = 10 * 60 * 1000;

const itWithNodeId = process.env.E2ECTL_MANUAL_NODE_ID ? it : it.skip;
const itWithDnsDomain = process.env.E2ECTL_MANUAL_DNS_DOMAIN ? it : it.skip;
const itWithReservedIp = process.env.E2ECTL_MANUAL_RESERVED_IP ? it : it.skip;
const itWithVolumeId = process.env.E2ECTL_MANUAL_VOLUME_ID ? it : it.skip;
const itWithVpcId = process.env.E2ECTL_MANUAL_VPC_ID ? it : it.skip;
const itWithSecurityGroupId = process.env.E2ECTL_MANUAL_SECURITY_GROUP_ID
  ? it
  : it.skip;
const itWithSshKeyId = process.env.E2ECTL_MANUAL_SSH_KEY_ID ? it : it.skip;

interface JsonCommandResult {
  action?: string;
}

interface NodeCatalogOsJson extends JsonCommandResult {
  entries: Array<{
    category: string;
    display_category: string;
    os: string;
    os_version: string;
  }>;
}

interface NodeCatalogPlansJson extends JsonCommandResult {
  items: unknown[];
}

interface NodeListJson extends JsonCommandResult {
  nodes: unknown[];
}

interface DnsListJson extends JsonCommandResult {
  items: unknown[];
}

interface ReservedIpListJson extends JsonCommandResult {
  items: unknown[];
}

interface VolumePlansJson extends JsonCommandResult {
  items: unknown[];
}

interface VolumeListJson extends JsonCommandResult {
  items: unknown[];
}

interface VpcPlansJson extends JsonCommandResult {
  committed: {
    items: unknown[];
  };
  hourly: {
    items: unknown[];
  };
}

interface VpcListJson extends JsonCommandResult {
  items: unknown[];
}

interface SecurityGroupListJson extends JsonCommandResult {
  items: unknown[];
}

interface SshKeyListJson extends JsonCommandResult {
  items: unknown[];
}

interface NodeGetJson extends JsonCommandResult {
  node: {
    id: number | string;
  };
}

interface DnsGetJson extends JsonCommandResult {
  domain: {
    domain_name: string;
    records: unknown[];
  };
}

interface DnsNameserversJson extends JsonCommandResult {
  configured_nameservers: unknown[];
  delegated_nameservers: unknown[];
  domain_name: string;
}

interface DnsRecordListJson extends JsonCommandResult {
  domain_name: string;
  items: unknown[];
}

interface ReservedIpGetJson extends JsonCommandResult {
  reserved_ip: {
    ip_address: string;
  };
}

interface VolumeGetJson extends JsonCommandResult {
  volume: {
    id: number | string;
  };
}

interface VpcGetJson extends JsonCommandResult {
  vpc: {
    id: number | string;
  };
}

interface SecurityGroupGetJson extends JsonCommandResult {
  security_group: {
    id: number | string;
    rules: unknown[];
  };
}

interface SshKeyGetJson extends JsonCommandResult {
  item: {
    id: number | string;
  };
}

let readOnlyEnv: ReadOnlyEnv;

describeManual('manual read-only built CLI checks', () => {
  beforeAll(async () => {
    readOnlyEnv = readReadOnlyEnv();

    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'covers node catalog and node list via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const osCatalog = await runJsonCommand<NodeCatalogOsJson>([
        'node',
        'catalog',
        'os'
      ]);

      expect(osCatalog.action).toBe('catalog-os');
      expect(osCatalog.entries.length).toBeGreaterThan(0);

      const entry = osCatalog.entries[0];

      expect(entry).toBeDefined();

      const plans = await runJsonCommand<NodeCatalogPlansJson>([
        'node',
        'catalog',
        'plans',
        '--display-category',
        entry!.display_category,
        '--category',
        entry!.category,
        '--os',
        entry!.os,
        '--os-version',
        entry!.os_version
      ]);

      expect(plans.action).toBe('catalog-plans');
      expect(Array.isArray(plans.items)).toBe(true);

      const nodeList = await runJsonCommand<NodeListJson>(['node', 'list']);

      expect(nodeList.action).toBe('list');
      expect(Array.isArray(nodeList.nodes)).toBe(true);
    }
  );

  it(
    'covers dns and reserved-ip list-safe flows via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const dnsList = await runJsonCommand<DnsListJson>(['dns', 'list']);

      expect(dnsList.action).toBe('list');
      expect(Array.isArray(dnsList.items)).toBe(true);

      const reservedIpList = await runJsonCommand<ReservedIpListJson>([
        'reserved-ip',
        'list'
      ]);

      expect(reservedIpList.action).toBe('list');
      expect(Array.isArray(reservedIpList.items)).toBe(true);
    }
  );

  it(
    'covers volume and vpc catalog-safe flows via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const volumePlans = await runJsonCommand<VolumePlansJson>([
        'volume',
        'plans'
      ]);

      expect(volumePlans.action).toBe('plans');
      expect(Array.isArray(volumePlans.items)).toBe(true);

      const volumeList = await runJsonCommand<VolumeListJson>([
        'volume',
        'list'
      ]);

      expect(volumeList.action).toBe('list');
      expect(Array.isArray(volumeList.items)).toBe(true);

      const vpcPlans = await runJsonCommand<VpcPlansJson>(['vpc', 'plans']);

      expect(vpcPlans.action).toBe('plans');
      expect(Array.isArray(vpcPlans.hourly.items)).toBe(true);
      expect(Array.isArray(vpcPlans.committed.items)).toBe(true);

      const vpcList = await runJsonCommand<VpcListJson>(['vpc', 'list']);

      expect(vpcList.action).toBe('list');
      expect(Array.isArray(vpcList.items)).toBe(true);
    }
  );

  it(
    'covers security-group and ssh-key list-safe flows via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const securityGroupList = await runJsonCommand<SecurityGroupListJson>([
        'security-group',
        'list'
      ]);

      expect(securityGroupList.action).toBe('list');
      expect(Array.isArray(securityGroupList.items)).toBe(true);

      const sshKeyList = await runJsonCommand<SshKeyListJson>([
        'ssh-key',
        'list'
      ]);

      expect(sshKeyList.action).toBe('list');
      expect(Array.isArray(sshKeyList.items)).toBe(true);
    }
  );

  itWithNodeId(
    'reads a specific node when E2ECTL_MANUAL_NODE_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const nodeId = readOnlyEnv.fixtures.nodeId!;
      const response = await runJsonCommand<NodeGetJson>([
        'node',
        'get',
        nodeId
      ]);

      expect(response.action).toBe('get');
      expect(String(response.node.id)).toBe(nodeId);
    }
  );

  itWithDnsDomain(
    'reads domain detail flows when E2ECTL_MANUAL_DNS_DOMAIN is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const dnsDomain = readOnlyEnv.fixtures.dnsDomain!;
      const domain = await runJsonCommand<DnsGetJson>([
        'dns',
        'get',
        dnsDomain
      ]);

      expect(domain.action).toBe('get');
      expect(domain.domain.domain_name.length).toBeGreaterThan(0);
      expect(Array.isArray(domain.domain.records)).toBe(true);

      const nameservers = await runJsonCommand<DnsNameserversJson>([
        'dns',
        'nameservers',
        dnsDomain
      ]);

      expect(nameservers.action).toBe('nameservers');
      expect(nameservers.domain_name.length).toBeGreaterThan(0);
      expect(Array.isArray(nameservers.configured_nameservers)).toBe(true);
      expect(Array.isArray(nameservers.delegated_nameservers)).toBe(true);

      const recordList = await runJsonCommand<DnsRecordListJson>([
        'dns',
        'record',
        'list',
        dnsDomain
      ]);

      expect(recordList.action).toBe('record-list');
      expect(recordList.domain_name.length).toBeGreaterThan(0);
      expect(Array.isArray(recordList.items)).toBe(true);
    }
  );

  itWithReservedIp(
    'reads one reserved IP when E2ECTL_MANUAL_RESERVED_IP is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const reservedIp = readOnlyEnv.fixtures.reservedIp!;
      const response = await runJsonCommand<ReservedIpGetJson>([
        'reserved-ip',
        'get',
        reservedIp
      ]);

      expect(response.action).toBe('get');
      expect(response.reserved_ip.ip_address).toBe(reservedIp);
    }
  );

  itWithVolumeId(
    'reads one volume when E2ECTL_MANUAL_VOLUME_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const volumeId = readOnlyEnv.fixtures.volumeId!;
      const response = await runJsonCommand<VolumeGetJson>([
        'volume',
        'get',
        volumeId
      ]);

      expect(response.action).toBe('get');
      expect(String(response.volume.id)).toBe(volumeId);
    }
  );

  itWithVpcId(
    'reads one VPC when E2ECTL_MANUAL_VPC_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const vpcId = readOnlyEnv.fixtures.vpcId!;
      const response = await runJsonCommand<VpcGetJson>(['vpc', 'get', vpcId]);

      expect(response.action).toBe('get');
      expect(String(response.vpc.id)).toBe(vpcId);
    }
  );

  itWithSecurityGroupId(
    'reads one security group when E2ECTL_MANUAL_SECURITY_GROUP_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const securityGroupId = readOnlyEnv.fixtures.securityGroupId!;
      const response = await runJsonCommand<SecurityGroupGetJson>([
        'security-group',
        'get',
        securityGroupId
      ]);

      expect(response.action).toBe('get');
      expect(String(response.security_group.id)).toBe(securityGroupId);
      expect(Array.isArray(response.security_group.rules)).toBe(true);
    }
  );

  itWithSshKeyId(
    'reads one SSH key when E2ECTL_MANUAL_SSH_KEY_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const sshKeyId = readOnlyEnv.fixtures.sshKeyId!;
      const response = await runJsonCommand<SshKeyGetJson>([
        'ssh-key',
        'get',
        sshKeyId
      ]);

      expect(response.action).toBe('get');
      expect(String(response.item.id)).toBe(sshKeyId);
    }
  );
});

async function runJsonCommand<T>(args: string[]): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: readOnlyEnv.cliEnv,
    timeoutMs: MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS
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
