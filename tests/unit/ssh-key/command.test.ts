import { writeFile } from 'node:fs/promises';

import { Command, CommanderError } from 'commander';

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
import type { LoadBalancerClient } from '../../../src/load-balancer/index.js';
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
  const deleteSshKey = vi.fn(() =>
    Promise.resolve({
      message: 'SSH Key has been deleted successfully.'
    })
  );

  const stub: SshKeyClient = {
    createSshKey,
    deleteSshKey,
    listSshKeys
  };

  return {
    createSshKey,
    deleteSshKey,
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
      createProjectClient: vi.fn(() => {
        throw new Error('Project client should not be created for this test.');
      }) as unknown as CliRuntime['createProjectClient'],
      createReservedIpClient: vi.fn(() => {
        throw new Error(
          'Reserved IP client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createReservedIpClient'],
      createSecurityGroupClient: vi.fn(() => {
        throw new Error(
          'Security group client should not be created for this test.'
        );
      }) as unknown as (credentials: ResolvedCredentials) => never,
      createSshKeyClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VolumeClient,
      createLoadBalancerClient: vi.fn(() => {
        throw new Error(
          'Load balancer client should not be created for this test.'
        );
      }) as unknown as (credentials: ResolvedCredentials) => LoadBalancerClient,
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

  async function renderHelp(args: string[]): Promise<string> {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    prepareProgramForHelp(program);
    const chunks: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        chunks.push(String(chunk));
        return true;
      });
    const restoreSpy = () => {
      stdoutSpy.mockRestore();
    };

    try {
      await program.parseAsync(['node', CLI_COMMAND_NAME, ...args]);
    } catch (error: unknown) {
      restoreSpy();

      if (
        !(error instanceof CommanderError) ||
        error.code !== 'commander.helpDisplayed'
      ) {
        throw error;
      }

      return chunks.join('');
    }

    restoreSpy();
    return chunks.join('');
  }

  function prepareProgramForHelp(program: Command): void {
    program.exitOverride();

    for (const childCommand of program.commands) {
      prepareProgramForHelp(childCommand);
    }
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

  it('renders human list output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'ssh-key',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID');
    expect(stdout.buffer).toContain('demo');
    expect(stdout.buffer).toContain('ED25519');
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

  it('renders human create output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);
    const publicKeyPath = createTestConfigPath('ssh-key-public-human');
    await writeFile(
      publicKeyPath,
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop\n',
      'utf8'
    );

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'ssh-key',
      'create',
      '--alias',
      'prod',
      '--label',
      'demo',
      '--public-key-file',
      publicKeyPath
    ]);

    expect(stdout.buffer).toContain('Added SSH key: demo');
    expect(stdout.buffer).toContain('ID: 15398');
    expect(stdout.buffer).toContain('Type: ED25519');
  });

  it('gets one SSH key in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'ssh-key',
      'get',
      '15398',
      '--alias',
      'prod'
    ]);

    expect(stub.listSshKeys).toHaveBeenCalledTimes(1);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'get',
        item: {
          attached_nodes: 2,
          created_at: '19-Feb-2025',
          id: 15398,
          label: 'demo',
          project_id: null,
          project_name: 'default-project',
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
          type: 'ED25519'
        }
      })}\n`
    );
  });

  it('renders human detail output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'ssh-key',
      'get',
      '15398',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 15398');
    expect(stdout.buffer).toContain('Label: demo');
    expect(stdout.buffer).toContain('Project: default-project');
    expect(stdout.buffer).toContain('Public Key: ssh-ed25519');
  });

  it('deletes one SSH key in deterministic json mode', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'ssh-key',
      'delete',
      '15398',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stub.deleteSshKey).toHaveBeenCalledWith(15398);
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        id: 15398,
        message: 'SSH Key has been deleted successfully.'
      })}\n`
    );
  });

  it('renders human delete output when json mode is off', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'ssh-key',
      'delete',
      '15398',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(stdout.buffer).toContain('Deleted SSH key 15398.');
    expect(stdout.buffer).toContain(
      'Message: SSH Key has been deleted successfully.'
    );
  });

  it('renders cancelled delete output when confirmation is declined', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    runtime.confirm = vi.fn(() => Promise.resolve(false));
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'ssh-key',
      'delete',
      '15398',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe('Deletion cancelled.\n');
  });

  it('shows root help for ssh-key commands', async () => {
    const help = await renderHelp(['ssh-key']);

    expect(help).toContain('Manage MyAccount SSH public keys.');
    expect(help).toContain('Show help for an ssh-key command');
  });

  it('shows help for ssh-key create', async () => {
    const help = await renderHelp(['ssh-key', 'create', '--help']);

    expect(help).toContain(
      'Create an SSH key from a public key file or stdin.'
    );
    expect(help).toContain('--public-key-file <path>');
    expect(help).toContain('--label <label>');
  });

  it('shows help for ssh-key delete', async () => {
    const help = await renderHelp(['ssh-key', 'delete', '--help']);

    expect(help).toContain('Delete a saved SSH key.');
    expect(help).toContain('--force');
  });
});
