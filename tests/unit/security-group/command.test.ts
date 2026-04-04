import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createSecurityGroupClientStub() {
  const createSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group created successfully.',
      result: {
        label_id: null,
        resource_type: null
      }
    })
  );
  const deleteSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group deleted successfully.',
      result: {
        name: 'web-sg'
      }
    })
  );
  const getSecurityGroup = vi.fn(() =>
    Promise.resolve({
      description: 'web ingress',
      id: 57358,
      is_all_traffic_rule: false,
      is_default: false,
      name: 'web-sg',
      rules: sampleRulesWithIds()
    })
  );
  const listSecurityGroups = vi.fn(() =>
    Promise.resolve([
      {
        description: 'web ingress',
        id: 57358,
        is_all_traffic_rule: false,
        is_default: false,
        name: 'web-sg',
        rules: sampleRulesWithIds()
      }
    ])
  );
  const updateSecurityGroup = vi.fn(() =>
    Promise.resolve({
      message: 'Security Group updated successfully.'
    })
  );

  const stub: SecurityGroupClient = {
    attachNodeSecurityGroups: vi.fn(),
    createSecurityGroup,
    deleteSecurityGroup,
    detachNodeSecurityGroups: vi.fn(),
    getSecurityGroup,
    listSecurityGroups,
    updateSecurityGroup
  };

  return {
    createSecurityGroup,
    deleteSecurityGroup,
    getSecurityGroup,
    listSecurityGroups,
    stub,
    updateSecurityGroup
  };
}

describe('security-group commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createSecurityGroupClientStub>;
  } {
    const configPath = createTestConfigPath('security-group-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createSecurityGroupClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => NodeClient,
      createSecurityGroupClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SshKeyClient,
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VolumeClient,
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VpcClient,
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: true,
      prompt: vi.fn(() => Promise.resolve('')),
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      receivedCredentials: () => credentials,
      runtime,
      stdout,
      stub
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
  }

  async function writeRulesFile(rules: unknown): Promise<string> {
    const filePath = createTestConfigPath('security-group-rules');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(rules, null, 2), 'utf8');
    return filePath;
  }

  it('lists security groups in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'security-group',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '12345'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'list',
        items: [
          {
            description: 'web ingress',
            id: 57358,
            is_all_traffic_rule: false,
            is_default: false,
            name: 'web-sg',
            rules: normalizeRulesForJson(sampleRulesWithIds())
          }
        ]
      })}\n`
    );
  });

  it('creates security groups from rules files in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);
    const rulesFilePath = await writeRulesFile(sampleRules());

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'security-group',
      'create',
      '--alias',
      'prod',
      '--name',
      'web-sg',
      '--rules-file',
      rulesFilePath,
      '--default'
    ]);

    expect(stub.createSecurityGroup).toHaveBeenCalledWith({
      default: true,
      description: '',
      name: 'web-sg',
      rules: sampleRules()
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        message: 'Security Group created successfully.',
        security_group: {
          description: '',
          id: 57358,
          is_default: true,
          label_id: null,
          name: 'web-sg',
          resource_type: null,
          rule_count: 2
        }
      })}\n`
    );
  });

  it('gets one security group in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'security-group',
      'get',
      '57358',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'get',
        security_group: {
          description: 'web ingress',
          id: 57358,
          is_all_traffic_rule: false,
          is_default: false,
          name: 'web-sg',
          rules: normalizeRulesForJson(sampleRulesWithIds())
        }
      })}\n`
    );
  });

  it('deletes one security group with --force in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'security-group',
      'delete',
      '57358',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: 'Security Group deleted successfully.',
        security_group: {
          id: 57358,
          name: 'web-sg'
        }
      })}\n`
    );
  });
});

function normalizeRulesForJson(rules: ReturnType<typeof sampleRulesWithIds>) {
  return rules.map((rule) => ({
    description: rule.description,
    id: rule.id,
    network: rule.network,
    network_cidr: rule.network_cidr,
    network_size: rule.network_size,
    port_range: rule.port_range,
    protocol_name: rule.protocol_name,
    rule_type: rule.rule_type,
    vpc_id: rule.vpc_id
  }));
}

function sampleRules() {
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

function sampleRulesWithIds() {
  return [
    {
      description: 'ssh',
      id: 285096,
      network: 'any',
      network_cidr: '--',
      network_size: 1,
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound',
      vpc_id: null
    },
    {
      description: '',
      id: 285097,
      network: 'any',
      network_cidr: '--',
      network_size: 1,
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound',
      vpc_id: null
    }
  ];
}
