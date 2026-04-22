import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { ImageClient } from '../../../src/image/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function makeImageSummary(overrides = {}) {
  return {
    creation_time: '01-Jan-2025 10:00:00',
    image_id: '1001',
    image_name: 'my-image',
    image_size: '20GB',
    image_state: 'READY',
    is_windows: false,
    node_plans_available: true,
    os_distribution: 'Ubuntu 22.04',
    project_name: 'default-project',
    running_vms: 2,
    scaler_group_count: 3,
    ...overrides
  };
}

function createImageClientStub() {
  const deleteImage = vi.fn(() =>
    Promise.resolve({ message: 'Image deleted successfully' })
  );
  const listImages = vi.fn(() => Promise.resolve([makeImageSummary()]));
  const renameImage = vi.fn(() =>
    Promise.resolve({
      message: 'Image name changed successfully',
      status: true
    })
  );

  const stub: ImageClient = {
    deleteImage,
    listImages,
    renameImage
  };

  return { deleteImage, listImages, renameImage, stub };
}

describe('image commands', () => {
  function createRuntimeFixture(options?: { confirmResult?: boolean }): {
    imageStub: ReturnType<typeof createImageClientStub>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
  } {
    const configPath = createTestConfigPath('image-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const imageStub = createImageClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(options?.confirmResult ?? true)),
      createImageClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return imageStub.stub;
      },
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as CliRuntime['createNodeClient'],
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
      }) as unknown as CliRuntime['createSecurityGroupClient'],
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as CliRuntime['createSshKeyClient'],
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as CliRuntime['createVolumeClient'],
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as CliRuntime['createVpcClient'],
      credentialValidator: { validate: vi.fn() },
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
      imageStub
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

  it('lists images in json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '12345'
    });
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      items: Array<{ image_id: string; scaler_group_count: number }>;
    };
    expect(parsed.action).toBe('list');
    expect(parsed.items[0]?.image_id).toBe('1001');
    expect(parsed.items[0]?.scaler_group_count).toBe(3);
  });

  it('renders human list output with scale groups column', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'image',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('my-image');
    expect(stdout.buffer).toContain('Scale Groups');
    expect(stdout.buffer).toContain('3');
  });

  it('deletes an image after confirmation', async () => {
    const { imageStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'delete',
      '1001',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(imageStub.deleteImage).toHaveBeenCalledWith('1001');
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      cancelled: boolean;
    };
    expect(parsed.action).toBe('delete');
    expect(parsed.cancelled).toBe(false);
  });

  it('cancels image delete through the command layer when confirmation is declined', async () => {
    const { imageStub, runtime, stdout } = createRuntimeFixture({
      confirmResult: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'image',
      'delete',
      '1001',
      '--alias',
      'prod'
    ]);

    expect(imageStub.deleteImage).not.toHaveBeenCalled();
    expect(stdout.buffer).toBe('Deletion cancelled.\n');
  });

  it('renames an image', async () => {
    const { imageStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'rename',
      '1001',
      '--alias',
      'prod',
      '--name',
      'renamed-image'
    ]);

    expect(imageStub.renameImage).toHaveBeenCalledWith('1001', 'renamed-image');
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      name: string;
    };
    expect(parsed.action).toBe('rename');
    expect(parsed.name).toBe('renamed-image');
  });

  it('outputs help when image command is called with no subcommand', async () => {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    const imageCommand = program.commands.find((c) => c.name() === 'image');

    await program.parseAsync(['node', CLI_COMMAND_NAME, 'image']);

    expect(imageCommand).toBeDefined();
    expect(imageCommand?.commands.map((c) => c.name())).toContain('list');
    expect(imageCommand?.commands.map((c) => c.name())).not.toContain('import');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('delete');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('rename');
    expect(imageCommand?.commands.map((c) => c.name())).not.toContain(
      'create-node'
    );
    expect(imageCommand?.helpInformation()).toContain('Manage saved images.');
  });
});
