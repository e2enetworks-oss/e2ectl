import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { ImageService } from '../../../src/image/service.js';
import type { ImageClient } from '../../../src/image/client.js';
import type { NodeClient } from '../../../src/node/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

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
    scaler_group_count: 1,
    ...overrides
  };
}

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  deleteImage: ReturnType<typeof vi.fn>;
  getImage: ReturnType<typeof vi.fn>;
  importImage: ReturnType<typeof vi.fn>;
  listImages: ReturnType<typeof vi.fn>;
  createNode: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  renameImage: ReturnType<typeof vi.fn>;
  service: ImageService;
} {
  const deleteImage = vi.fn();
  const getImage = vi.fn();
  const importImage = vi.fn();
  const listImages = vi.fn();
  const renameImage = vi.fn();
  const createNode = vi.fn();
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  let credentials: ResolvedCredentials | undefined;

  const imageClient: ImageClient = {
    deleteImage,
    getImage,
    importImage,
    listImages,
    renameImage
  };

  const nodeClient: NodeClient = {
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

  const service = new ImageService({
    confirm,
    createImageClient: vi.fn((resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return imageClient;
    }),
    createNodeClient: vi.fn(() => nodeClient),
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
    deleteImage,
    getImage,
    importImage,
    listImages,
    createNode,
    receivedCredentials: () => credentials,
    renameImage,
    service
  };
}

describe('ImageService', () => {
  it('lists images and maps api fields to ImageItem shape', async () => {
    const { listImages, receivedCredentials, service } =
      createServiceFixture();

    listImages.mockResolvedValue([makeImageSummary()]);

    const result = await service.listImages({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(result).toEqual({
      action: 'list',
      items: [
        {
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
          scaler_group_count: 1
        }
      ]
    });
  });

  it('defaults optional fields when absent from api response', async () => {
    const { listImages, service } = createServiceFixture();

    listImages.mockResolvedValue([
      {
        creation_time: '01-Jan-2025 10:00:00',
        image_id: '1002',
        image_name: 'minimal-image',
        image_size: '10GB',
        image_state: 'READY',
        os_distribution: 'CentOS 7',
        running_vms: 0
      }
    ]);

    const result = await service.listImages({});

    expect(result.items[0]).toMatchObject({
      is_windows: false,
      node_plans_available: false,
      project_name: null,
      scaler_group_count: 0
    });
  });

  it('gets a single image by id', async () => {
    const { getImage, service } = createServiceFixture();

    getImage.mockResolvedValue(makeImageSummary());

    const result = await service.getImage('1001', { alias: 'prod' });

    expect(getImage).toHaveBeenCalledWith('1001');
    expect(result).toMatchObject({ action: 'get', item: { image_id: '1001' } });
  });

  it('imports an image from a public url', async () => {
    const { importImage, service } = createServiceFixture();

    importImage.mockResolvedValue({
      message: 'The image import job has been initiated successfully.'
    });

    const result = await service.importImage({
      alias: 'prod',
      name: 'imported-image',
      url: 'https://example.com/image.qcow2'
    });

    expect(importImage).toHaveBeenCalledWith(
      expect.objectContaining({
        image_name: 'imported-image',
        public_url: 'https://example.com/image.qcow2'
      })
    );
    expect(result).toEqual({
      action: 'import',
      message: 'The image import job has been initiated successfully.'
    });
  });

  it('passes the os option when provided on import', async () => {
    const { importImage, service } = createServiceFixture();

    importImage.mockResolvedValue({ message: 'OK' });

    await service.importImage({
      name: 'ubuntu-image',
      os: 'UBUNTU',
      url: 'https://example.com/ubuntu.qcow2'
    });

    expect(importImage).toHaveBeenCalledWith(
      expect.objectContaining({ os: 'UBUNTU' })
    );
  });

  it('rejects blank name on import', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.importImage({ name: '  ', url: 'https://example.com/img.qcow2' })
    ).rejects.toMatchObject({ message: 'Name cannot be empty.' });
  });

  it('deletes an image after confirmation', async () => {
    const { confirm, deleteImage, service } = createServiceFixture({
      confirmResult: true
    });

    deleteImage.mockResolvedValue({ message: 'Image deleted successfully' });

    const result = await service.deleteImage('1001', {});

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith('1001');
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      id: '1001',
      message: 'Image deleted successfully'
    });
  });

  it('cancels delete when user declines confirmation', async () => {
    const { confirm, deleteImage, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteImage('1001', {});

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteImage).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      id: '1001'
    });
  });

  it('skips confirmation prompt when --force is set', async () => {
    const { confirm, deleteImage, service } = createServiceFixture();

    deleteImage.mockResolvedValue({ message: 'Image deleted successfully' });

    await service.deleteImage('1001', { force: true });

    expect(confirm).not.toHaveBeenCalled();
    expect(deleteImage).toHaveBeenCalledWith('1001');
  });

  it('rejects delete without --force in non-interactive mode', async () => {
    const { service } = createServiceFixture({ isInteractive: false });

    await expect(service.deleteImage('1001', {})).rejects.toMatchObject({
      message: expect.stringContaining('requires confirmation')
    });
  });

  it('renames an image', async () => {
    const { renameImage, service } = createServiceFixture();

    renameImage.mockResolvedValue({
      message: 'Image name changed successfully',
      status: true
    });

    const result = await service.renameImage('1001', { name: 'new-name' });

    expect(renameImage).toHaveBeenCalledWith('1001', 'new-name');
    expect(result).toEqual({
      action: 'rename',
      id: '1001',
      message: 'Image name changed successfully',
      name: 'new-name'
    });
  });

  it('rejects blank name on rename', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.renameImage('1001', { name: '' })
    ).rejects.toMatchObject({ message: 'Name cannot be empty.' });
  });

  it('creates a node from a saved image with is_saved_image: true', async () => {
    const { createNode, service } = createServiceFixture();

    createNode.mockResolvedValue({
      node_create_response: [
        { id: 9001, name: 'web-01', plan: 'e2-standard-2', status: 'new' }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    });

    const result = await service.createNodeFromImage('1001', {
      name: 'web-01',
      plan: 'e2-standard-2'
    });

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        image: '1001',
        is_saved_image: true,
        name: 'web-01',
        plan: 'e2-standard-2'
      })
    );
    expect(result).toMatchObject({
      action: 'create-node',
      image_id: '1001',
      result: expect.objectContaining({
        total_number_of_node_created: 1
      })
    });
  });

  it('attaches ssh keys when creating a node from an image', async () => {
    const { createNode, service } = createServiceFixture();

    createNode.mockResolvedValue({
      node_create_response: [
        { id: 9002, name: 'db-01', plan: 'e2-standard-4', status: 'new' }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    });

    await service.createNodeFromImage('1001', {
      name: 'db-01',
      plan: 'e2-standard-4',
      sshKeyIds: ['101', '102']
    });

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({ ssh_keys: ['101', '102'] })
    );
  });

  it('rejects blank name when creating a node from an image', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createNodeFromImage('1001', { name: '', plan: 'e2-standard-2' })
    ).rejects.toMatchObject({ message: 'Name cannot be empty.' });
  });
});
