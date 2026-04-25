import { Command, CommanderError } from 'commander';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type {
  ResolvedAccountCredentials,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { ProjectClient } from '../../../src/project/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createProjectClientStub() {
  const listProjects = vi.fn(() =>
    Promise.resolve([
      {
        is_default: true,
        is_starred: false,
        name: 'default-project',
        project_id: 12345
      }
    ])
  );

  const createProject = vi.fn(() =>
    Promise.resolve({
      project_id: 99001,
      project_name: 'new-project'
    })
  );

  const starUnstarProject = vi.fn(
    (body: { is_starred: boolean; name: string; project_id: number }) =>
      Promise.resolve({
        project_id: body.project_id,
        project_name: body.name
      })
  );

  const stub: ProjectClient = {
    createProject,
    listProjects,
    starUnstarProject
  };

  return {
    createProject,
    listProjects,
    stub
  };
}

describe('project commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedAccountCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createProjectClientStub>;
  } {
    const configPath = createTestConfigPath('project-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createProjectClientStub();
    let credentials: ResolvedAccountCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createImageClient: vi.fn(() => {
        throw new Error('Image client should not be created for this test.');
      }) as unknown as CliRuntime['createImageClient'],
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => NodeClient,
      createProjectClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      createReservedIpClient: vi.fn(() => {
        throw new Error(
          'Reserved IP client should not be created for this test.'
        );
      }) as unknown as (credentials: ResolvedCredentials) => ReservedIpClient,
      createSecurityGroupClient: vi.fn(() => {
        throw new Error(
          'Security group client should not be created for this test.'
        );
      }) as unknown as (
        credentials: ResolvedCredentials
      ) => SecurityGroupClient,
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

  it('lists projects in deterministic json mode using account-scoped credentials', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'project',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toEqual({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token',
      location: 'Delhi',
      project_id: '12345',
      source: 'profile'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'list',
        items: [
          {
            is_cli_default_project: true,
            is_default: true,
            is_starred: false,
            name: 'default-project',
            project_id: 12345
          }
        ]
      })}\n`
    );
  });

  it('renders human project output while keeping account-scoped credentials', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'project',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toEqual({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token',
      location: 'Delhi',
      project_id: '12345',
      source: 'profile'
    });
    expect(stdout.buffer).toContain('ID');
    expect(stdout.buffer).toContain('default-project');
  });

  it('creates a project in deterministic json mode', async () => {
    const { receivedCredentials, runtime, stdout, stub } =
      createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'project',
      'create',
      '--name',
      'new-project',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token'
    });
    expect(stub.createProject).toHaveBeenCalledWith({ name: 'new-project' });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'create',
        name: 'new-project',
        project_id: 99001
      })}\n`
    );
  });

  it('renders human output for project create', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'project',
      'create',
      '--name',
      'new-project',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Created project: new-project');
    expect(stdout.buffer).toContain('ID: 99001');
  });

  it('stars a project in json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'project',
      'star',
      '12345',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'star',
        name: 'default-project',
        project_id: 12345
      })}\n`
    );
  });

  it('unstars a project in json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'project',
      'unstar',
      '12345',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'unstar',
        name: 'default-project',
        project_id: 12345
      })}\n`
    );
  });

  it('renders human output for project star', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'project',
      'star',
      '12345',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('Starred project: default-project');
    expect(stdout.buffer).toContain('ID: 12345');
  });

  it('shows root help for the project command', async () => {
    const output = await renderHelp(['project', '--help']);

    expect(output).toContain('Manage account-scoped MyAccount projects.');
    expect(output).toContain('list');
    expect(output).toContain('create');
    expect(output).toContain('star');
    expect(output).toContain('unstar');
    expect(output).toContain('Show help for a project command');
  });
});
