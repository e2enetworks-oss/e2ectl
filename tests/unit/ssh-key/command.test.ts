import { writeFile } from 'node:fs/promises';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createSshKeyClientStub() {
  const createSshKey = vi.fn(() =>
    Promise.resolve({
      label: 'demo',
      pk: 15398,
      project_id: '12345',
      ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
      timestamp: '19-Feb-2025'
    })
  );
  const listSshKeys = vi.fn(() =>
    Promise.resolve([
      {
        label: 'demo',
        pk: 15398,
        project_name: 'default-project',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
        ssh_key_type: 'ED25519',
        timestamp: '19-Feb-2025',
        total_attached_nodes: 2
      }
    ])
  );

  const stub: SshKeyClient = {
    createSshKey,
    listSshKeys
  };

  return {
    createSshKey,
    listSshKeys,
    stub
  };
}

describe('ssh-key commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createSshKeyClientStub>;
  } {
    const configPath = createTestConfigPath('ssh-key-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createSshKeyClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => NodeClient,
      createSshKeyClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
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

  it('lists SSH keys in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'ssh-key',
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
            attached_nodes: 2,
            created_at: '19-Feb-2025',
            id: 15398,
            label: 'demo',
            project_id: null,
            project_name: 'default-project',
            public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
            type: 'ED25519'
          }
        ]
      })}\n`
    );
  });

  it('creates SSH keys from files in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);
    const publicKeyPath = createTestConfigPath('ssh-key-public');
    await writeFile(
      publicKeyPath,
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop\n',
      'utf8'
    );

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'ssh-key',
      'create',
      '--alias',
      'prod',
      '--label',
      'demo',
      '--public-key-file',
      publicKeyPath
    ]);

    expect(stub.createSshKey).toHaveBeenCalledWith({
      label: 'demo',
      ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        item: {
          attached_nodes: 0,
          created_at: '19-Feb-2025',
          id: 15398,
          label: 'demo',
          project_id: '12345',
          project_name: null,
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
          type: 'ED25519'
        }
      })}\n`
    );
  });
});
