import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { ImageClient } from '../../../src/image/index.js';
import type { NodeClient } from '../../../src/node/index.js';
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
  const getImage = vi.fn(() => Promise.resolve(makeImageSummary()));
  const importImage = vi.fn(() =>
    Promise.resolve({
      message: 'The image import job has been initiated successfully.'
    })
  );
  const listImages = vi.fn(() => Promise.resolve([makeImageSummary()]));
  const renameImage = vi.fn(() =>
    Promise.resolve({ message: 'Image name changed successfully', status: true })
  );

  const stub: ImageClient = {
    deleteImage,
    getImage,
    importImage,
    listImages,
    renameImage
  };

  return { deleteImage, getImage, importImage, listImages, renameImage, stub };
}

function createNodeClientStub() {
  const createNode = vi.fn(() =>
    Promise.resolve({
      node_create_response: [
        { id: 9001, name: 'web-01', plan: 'e2-standard-2', status: 'new' }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    })
  );

  const stub: NodeClient = {
    attachSshKeys: vi.fn(),
    createNode,
    deleteNode: vi.fn(),
    getNode: vi.fn(),
    listNodeCatalogOs: vi.fn(),
    listNodeCatalogPlans: vi.fn(),
    listNodes: vi.fn(),
    powerOffNode: vi.fn(),
    powerOnNode: vi.fn(),
    saveNodeImage: vi.fn(),
    upgradeNode: vi.fn()
  };

  return { createNode, stub };
}

describe('image commands', () => {
  function createRuntimeFixture(): {
    imageStub: ReturnType<typeof createImageClientStub>;
    nodeStub: ReturnType<typeof createNodeClientStub>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
  } {
    const configPath = createTestConfigPath('image-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const imageStub = createImageClientStub();
    const nodeStub = createNodeClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createImageClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return imageStub.stub;
      },
      createNodeClient: () => nodeStub.stub,
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
      imageStub,
      nodeStub
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

  it('gets an image in json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'get',
      '1001',
      '--alias',
      'prod'
    ]);

    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      item: { image_id: string };
    };
    expect(parsed.action).toBe('get');
    expect(parsed.item.image_id).toBe('1001');
  });

  it('imports an image from a public url', async () => {
    const { imageStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'import',
      '--alias',
      'prod',
      '--name',
      'my-import',
      '--url',
      'https://example.com/image.qcow2',
      '--os',
      'UBUNTU'
    ]);

    expect(imageStub.importImage).toHaveBeenCalledWith(
      expect.objectContaining({
        image_name: 'my-import',
        public_url: 'https://example.com/image.qcow2',
        os: 'UBUNTU'
      })
    );
    const parsed = JSON.parse(stdout.buffer) as { action: string };
    expect(parsed.action).toBe('import');
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

  it('creates a node from a saved image', async () => {
    const { nodeStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'image',
      'create-node',
      '1001',
      '--alias',
      'prod',
      '--name',
      'web-01',
      '--plan',
      'e2-standard-2'
    ]);

    expect(nodeStub.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        image: '1001',
        is_saved_image: true,
        name: 'web-01',
        plan: 'e2-standard-2'
      })
    );
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      image_id: string;
    };
    expect(parsed.action).toBe('create-node');
    expect(parsed.image_id).toBe('1001');
  });

  it('attaches multiple ssh keys when creating a node from an image', async () => {
    const { nodeStub, runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'image',
      'create-node',
      '1001',
      '--alias',
      'prod',
      '--name',
      'web-01',
      '--plan',
      'e2-standard-2',
      '--ssh-key-id',
      '101',
      '--ssh-key-id',
      '102'
    ]);

    expect(nodeStub.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ ssh_keys: ['101', '102'] })
    );
  });

  it('outputs help when image command is called with no subcommand', () => {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    const imageCommand = program.commands.find((c) => c.name() === 'image');

    expect(imageCommand).toBeDefined();
    expect(imageCommand?.commands.map((c) => c.name())).toContain('list');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('import');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('delete');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('rename');
    expect(imageCommand?.commands.map((c) => c.name())).toContain('create-node');
  });
});
