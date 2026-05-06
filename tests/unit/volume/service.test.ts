import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { AppError, EXIT_CODES } from '../../../src/core/errors.js';
import { VolumeService } from '../../../src/volume/service.js';
import type { VolumeClient } from '../../../src/volume/index.js';

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

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  createVolume: ReturnType<typeof vi.fn>;
  createVolumeClient: ReturnType<typeof vi.fn>;
  deleteVolume: ReturnType<typeof vi.fn>;
  getVolume: ReturnType<typeof vi.fn>;
  listVolumePlans: ReturnType<typeof vi.fn>;
  listVolumes: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: VolumeService;
} {
  const createVolume = vi.fn();
  const deleteVolume = vi.fn();
  const getVolume = vi.fn();
  const listVolumePlans = vi.fn();
  const listVolumes = vi.fn();
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  let credentials: ResolvedCredentials | undefined;

  const client: VolumeClient = {
    attachVolumeToNode: vi.fn(),
    createVolume,
    deleteVolume,
    detachVolumeFromNode: vi.fn(),
    getVolume,
    listVolumePlans,
    listVolumes
  };
  const createVolumeClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    }
  );
  const service = new VolumeService({
    confirm,
    createVolumeClient,
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
    createVolume,
    createVolumeClient,
    deleteVolume,
    getVolume,
    listVolumePlans,
    listVolumes,
    receivedCredentials: () => credentials,
    service
  };
}

describe('VolumeService', () => {
  it('collects paginated volume list data and resolves saved defaults', async () => {
    const { listVolumes, receivedCredentials, service } =
      createServiceFixture();

    listVolumes
      .mockResolvedValueOnce({
        items: [
          {
            block_id: 22,
            name: 'zeta-data',
            size: 476837,
            size_string: '500 GB',
            status: 'Attached',
            vm_detail: {
              node_id: 301,
              vm_id: 100157,
              vm_name: 'node-b'
            }
          }
        ],
        total_count: 2,
        total_page_number: 2
      })
      .mockResolvedValueOnce({
        items: [
          {
            block_id: 11,
            name: 'alpha-data',
            size: 238419,
            size_string: '250 GB',
            status: 'Available',
            vm_detail: {}
          }
        ],
        total_count: 2,
        total_page_number: 2
      });

    const result = await service.listVolumes({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(listVolumes).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listVolumes).toHaveBeenNthCalledWith(2, 2, 100);
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          attached: true,
          attachment: {
            node_id: 301,
            vm_id: 100157,
            vm_name: 'node-b'
          },
          id: 22,
          name: 'zeta-data',
          size_gb: 500,
          size_label: '500 GB',
          status: 'Attached'
        },
        {
          attached: false,
          attachment: null,
          id: 11,
          name: 'alpha-data',
          size_gb: 250,
          size_label: '250 GB',
          status: 'Available'
        }
      ],
      total_count: 2,
      total_page_number: 2
    });
  });

  it('gets one volume through the detail path and normalizes detail flags', async () => {
    const { getVolume, service } = createServiceFixture();

    getVolume.mockResolvedValue({
      block_id: 22,
      is_block_storage_exporting_to_eos: true,
      name: 'zeta-data',
      size: 476837,
      size_string: '500 GB',
      snapshot_exist: true,
      status: 'Attached',
      vm_detail: {
        node_id: 301,
        vm_id: 100157,
        vm_name: 'node-b'
      }
    });

    const result = await service.getVolume('22', { alias: 'prod' });

    expect(getVolume).toHaveBeenCalledWith(22);
    expect(result).toEqual({
      action: 'get',
      volume: {
        attached: true,
        attachment: {
          node_id: 301,
          vm_id: 100157,
          vm_name: 'node-b'
        },
        exporting_to_eos: true,
        id: 22,
        name: 'zeta-data',
        size_gb: 500,
        size_label: '500 GB',
        snapshot_exists: true,
        status: 'Attached'
      }
    });
  });

  it('deletes one volume with an explicit force flag', async () => {
    const { deleteVolume, service } = createServiceFixture();

    deleteVolume.mockResolvedValue({
      message: 'Block Storage Deleted'
    });

    const result = await service.deleteVolume('22', {
      alias: 'prod',
      force: true
    });

    expect(deleteVolume).toHaveBeenCalledWith(22);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Block Storage Deleted',
      volume_id: 22
    });
  });

  it('treats delete timeouts as success when a follow-up list shows the volume is gone', async () => {
    const { deleteVolume, listVolumes, service } = createServiceFixture();

    deleteVolume.mockRejectedValue(
      new AppError('Delete request timed out.', {
        code: 'API_TIMEOUT',
        exitCode: EXIT_CODES.network
      })
    );
    listVolumes.mockResolvedValue({
      items: [],
      total_count: 0,
      total_page_number: 1
    });

    const result = await service.deleteVolume('22', {
      alias: 'prod',
      force: true
    });

    expect(listVolumes).toHaveBeenCalledWith(1, 100);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Block Storage Deleted',
      volume_id: 22
    });
  });

  it('rethrows the original delete timeout when the volume still exists after reconciliation', async () => {
    const { deleteVolume, listVolumes, service } = createServiceFixture();
    const timeoutError = new AppError('Delete request timed out.', {
      code: 'API_TIMEOUT',
      exitCode: EXIT_CODES.network
    });

    deleteVolume.mockRejectedValue(timeoutError);
    listVolumes.mockResolvedValue({
      items: [
        {
          block_id: 22,
          name: 'zeta-data',
          size: 476837,
          size_string: '500 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    await expect(
      service.deleteVolume('22', {
        alias: 'prod',
        force: true
      })
    ).rejects.toBe(timeoutError);
    expect(listVolumes).toHaveBeenCalledWith(1, 100);
  });

  it('preserves the original delete timeout when reconciliation also fails', async () => {
    const { deleteVolume, listVolumes, service } = createServiceFixture();
    const timeoutError = new AppError('Delete request timed out.', {
      code: 'API_TIMEOUT',
      exitCode: EXIT_CODES.network
    });

    deleteVolume.mockRejectedValue(timeoutError);
    listVolumes.mockRejectedValue(
      new AppError('List request timed out.', {
        code: 'API_TIMEOUT',
        exitCode: EXIT_CODES.network
      })
    );

    await expect(
      service.deleteVolume('22', {
        alias: 'prod',
        force: true
      })
    ).rejects.toBe(timeoutError);
    expect(listVolumes).toHaveBeenCalledWith(1, 100);
  });

  it('groups committed options under each normalized size plan', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days Committed , INR 1000',
            committed_sku_price: 1000
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: true,
        bs_size: 1,
        committed_sku: [],
        currency: 'INR',
        iops: 15000,
        name: '1 TB',
        price: 5
      }
    ]);

    const result = await service.listVolumePlans({ alias: 'prod' });

    expect(result).toEqual({
      action: 'plans',
      filters: {
        available_only: false,
        size_gb: null
      },
      items: [
        {
          available: true,
          committed_options: [
            {
              id: 31,
              name: '30 Days Committed',
              savings_percent: 18.78,
              term_days: 30,
              total_price: 1000
            }
          ],
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        },
        {
          available: true,
          committed_options: [],
          currency: 'INR',
          hourly_price: 6.85,
          iops: 15000,
          size_gb: 1000
        }
      ],
      total_count: 2
    });
  });

  it('filters plan discovery to a requested size', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: false,
        bs_size: 1,
        committed_sku: [],
        currency: 'INR',
        iops: 15000,
        name: '1 TB',
        price: 5
      }
    ]);

    const result = await service.listVolumePlans({
      alias: 'prod',
      size: '250'
    });

    expect(result).toEqual({
      action: 'plans',
      filters: {
        available_only: false,
        size_gb: 250
      },
      items: [
        {
          available: true,
          committed_options: [],
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        }
      ],
      total_count: 1
    });
  });

  it('filters out unavailable sizes when requested', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: false,
        bs_size: 1,
        committed_sku: [],
        currency: 'INR',
        iops: 15000,
        name: '1 TB',
        price: 5
      }
    ]);

    const result = await service.listVolumePlans({
      alias: 'prod',
      availableOnly: true
    });

    expect(result).toEqual({
      action: 'plans',
      filters: {
        available_only: true,
        size_gb: null
      },
      items: [
        {
          available: true,
          committed_options: [],
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        }
      ],
      total_count: 1
    });
  });

  it('derives iops from the selected size plan for committed volume creation', async () => {
    const { createVolume, listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days Committed , INR 1000',
            committed_sku_price: 1000
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);
    createVolume.mockResolvedValue({
      id: 25550,
      image_name: 'data-01'
    });

    const result = await service.createVolume({
      alias: 'prod',
      billingType: 'committed',
      committedPlanId: '31',
      name: 'data-01',
      postCommitBehavior: 'hourly-billing',
      size: '250'
    });

    expect(createVolume).toHaveBeenCalledWith({
      cn_id: 31,
      cn_status: 'hourly_billing',
      iops: 5000,
      name: 'data-01',
      size: 250
    });
    expect(result).toEqual({
      action: 'create',
      billing: {
        committed_plan: {
          id: 31,
          name: '30 Days Committed',
          savings_percent: 18.78,
          term_days: 30,
          total_price: 1000
        },
        post_commit_behavior: 'hourly-billing',
        type: 'committed'
      },
      requested: {
        name: 'data-01',
        size_gb: 250
      },
      resolved_plan: {
        available: true,
        currency: 'INR',
        hourly_price: 1.71,
        iops: 5000,
        size_gb: 250
      },
      volume: {
        id: 25550,
        name: 'data-01'
      }
    });
  });

  it('rejects blank names locally', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVolume({
        billingType: 'hourly',
        name: '   ',
        size: '250'
      })
    ).rejects.toMatchObject({
      message: 'Name cannot be empty.'
    });
  });

  it('requires a committed plan id for committed billing', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVolume({
        billingType: 'committed',
        name: 'data-01',
        size: '250'
      })
    ).rejects.toMatchObject({
      message:
        'Committed plan ID is required when --billing-type committed is used.'
    });
  });

  it('rejects committed-only flags on hourly billing', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVolume({
        billingType: 'hourly',
        committedPlanId: '31',
        name: 'data-01',
        size: '250'
      })
    ).rejects.toMatchObject({
      message:
        'Committed plan ID can only be used with --billing-type committed.'
    });

    await expect(
      service.createVolume({
        billingType: 'hourly',
        name: 'data-01',
        postCommitBehavior: 'auto-renew',
        size: '250'
      })
    ).rejects.toMatchObject({
      message:
        '--post-commit-behavior can only be used with --billing-type committed.'
    });
  });

  it('validates numeric size input locally', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVolume({
        billingType: 'hourly',
        name: 'data-01',
        size: 'two-fifty'
      })
    ).rejects.toMatchObject({
      message: 'Size must be a positive integer.'
    });

    await expect(
      service.createVolume({
        billingType: 'hourly',
        name: 'data-01',
        size: '0'
      })
    ).rejects.toMatchObject({
      message: 'Size must be greater than zero.'
    });
  });

  it('fails clearly when no size plan matches the requested volume size', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.5,
        committed_sku: [],
        currency: 'INR',
        iops: 7500,
        name: '500 GB',
        price: 5
      }
    ]);

    await expect(
      service.createVolume({
        alias: 'prod',
        billingType: 'hourly',
        name: 'data-01',
        size: '250'
      })
    ).rejects.toMatchObject({
      message: 'No active volume plan matches 250 GB in the selected location.'
    });
  });

  it('fails clearly when multiple active plans match the same size', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 6000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      service.createVolume({
        alias: 'prod',
        billingType: 'hourly',
        name: 'data-01',
        size: '250'
      })
    ).rejects.toMatchObject({
      message:
        'Multiple active volume plans match 250 GB, so the CLI cannot derive a unique IOPS value safely.'
    });
  });
});

describe('VolumeService.listVolumes — pagination', () => {
  it('returns all items from a single-page response', async () => {
    const { listVolumes, service } = createServiceFixture();

    listVolumes.mockResolvedValueOnce({
      items: [
        {
          block_id: 1,
          name: 'vol-a',
          size_string: '100 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    const result = await service.listVolumes({ alias: 'prod' });

    expect(listVolumes).toHaveBeenCalledTimes(1);
    expect(listVolumes).toHaveBeenCalledWith(1, 100);
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          attached: false,
          attachment: null,
          id: 1,
          name: 'vol-a',
          size_gb: 100,
          size_label: '100 GB',
          status: 'Available'
        }
      ],
      total_count: 1,
      total_page_number: 1
    });
  });

  it('fetches exactly two pages and collects all items in order', async () => {
    const { listVolumes, service } = createServiceFixture();

    listVolumes
      .mockResolvedValueOnce({
        items: [
          {
            block_id: 10,
            name: 'vol-first',
            size_string: '200 GB',
            status: 'Available',
            vm_detail: {}
          }
        ],
        total_count: 2,
        total_page_number: 2
      })
      .mockResolvedValueOnce({
        items: [
          {
            block_id: 20,
            name: 'vol-second',
            size_string: '400 GB',
            status: 'Attached',
            vm_detail: {
              node_id: 5,
              vm_id: 9001,
              vm_name: 'worker-1'
            }
          }
        ],
        total_count: 2,
        total_page_number: 2
      });

    const result = await service.listVolumes({ alias: 'prod' });

    expect(listVolumes).toHaveBeenCalledTimes(2);
    expect(listVolumes).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listVolumes).toHaveBeenNthCalledWith(2, 2, 100);
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          attached: false,
          attachment: null,
          id: 10,
          name: 'vol-first',
          size_gb: 200,
          size_label: '200 GB',
          status: 'Available'
        },
        {
          attached: true,
          attachment: {
            node_id: 5,
            vm_id: 9001,
            vm_name: 'worker-1'
          },
          id: 20,
          name: 'vol-second',
          size_gb: 400,
          size_label: '400 GB',
          status: 'Attached'
        }
      ],
      total_count: 2,
      total_page_number: 2
    });
  });

  it('exits after one fetch when total_page_number is 0 (treated as 1)', async () => {
    const { listVolumes, service } = createServiceFixture();

    listVolumes.mockResolvedValueOnce({
      items: [
        {
          block_id: 7,
          name: 'vol-zero-pages',
          size_string: '50 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 0
    });

    const result = await service.listVolumes({ alias: 'prod' });

    expect(listVolumes).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 7, name: 'vol-zero-pages' });
  });

  it('exits after one fetch when total_page_number is undefined (treated as 1)', async () => {
    const { listVolumes, service } = createServiceFixture();

    listVolumes.mockResolvedValueOnce({
      items: [
        {
          block_id: 3,
          name: 'vol-no-meta',
          size_string: '75 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: undefined
    });

    const result = await service.listVolumes({ alias: 'prod' });

    expect(listVolumes).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 3, name: 'vol-no-meta' });
  });

  it('throws PAGINATION_LIMIT_EXCEEDED before making more than 500 requests when API always reports 999 pages', async () => {
    const { listVolumes, service } = createServiceFixture();

    listVolumes.mockResolvedValue({
      items: [
        {
          block_id: 99,
          name: 'vol-runaway',
          size_string: '10 GB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 99900,
      total_page_number: 999
    });

    await expect(service.listVolumes({ alias: 'prod' })).rejects.toMatchObject({
      code: 'PAGINATION_LIMIT_EXCEEDED'
    });

    expect(listVolumes.mock.calls.length).toBeLessThanOrEqual(500);
  });

  it('resolves all five concurrent listVolumes calls independently without shared state corruption', async () => {
    const fixtures = Array.from({ length: 5 }, (_, index) => {
      const fixture = createServiceFixture();
      fixture.listVolumes.mockResolvedValueOnce({
        items: [
          {
            block_id: 100 + index,
            name: `vol-concurrent-${index}`,
            size_string: '100 GB',
            status: 'Available',
            vm_detail: {}
          }
        ],
        total_count: 1,
        total_page_number: 1
      });
      return fixture;
    });

    const results = await Promise.all(
      fixtures.map((fixture) => fixture.service.listVolumes({ alias: 'prod' }))
    );

    expect(results).toHaveLength(5);

    for (let index = 0; index < 5; index++) {
      expect(results[index]).toMatchObject({ action: 'list' });
      expect(results[index]!.items).toHaveLength(1);
      expect(results[index]!.items[0]).toMatchObject({
        id: 100 + index,
        name: `vol-concurrent-${index}`
      });
      expect(fixtures[index]!.listVolumes).toHaveBeenCalledTimes(1);
    }
  });
});

describe('VolumeService.deleteVolume — edge cases', () => {
  it('returns a cancelled result when the confirmation prompt is declined', async () => {
    const { confirm, deleteVolume, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteVolume('22', { alias: 'prod' });

    expect(confirm).toHaveBeenCalledWith(
      'Delete volume 22? This cannot be undone.'
    );
    expect(deleteVolume).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      volume_id: 22
    });
  });

  it('requires --force when delete runs in a non-interactive terminal', async () => {
    const { confirm, deleteVolume, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteVolume('22', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a volume requires confirmation in an interactive terminal.'
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteVolume).not.toHaveBeenCalled();
  });

  it('rethrows non-timeout delete failures without attempting reconciliation', async () => {
    const { deleteVolume, listVolumes, service } = createServiceFixture();
    const error = new AppError('Delete failed.', {
      code: 'API_REQUEST_FAILED',
      exitCode: EXIT_CODES.network
    });

    deleteVolume.mockRejectedValue(error);

    await expect(
      service.deleteVolume('22', {
        alias: 'prod',
        force: true
      })
    ).rejects.toBe(error);
    expect(listVolumes).not.toHaveBeenCalled();
  });
});

describe('VolumeService.listVolumePlans — edge cases', () => {
  it('rejects a requested size that does not exist in the selected location', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      service.listVolumePlans({
        alias: 'prod',
        size: '500'
      })
    ).rejects.toMatchObject({
      code: 'VOLUME_PLAN_NOT_FOUND',
      message: 'No volume plan matches 500 GB in the selected location.'
    });
  });

  it('rejects an unavailable requested size when --available-only is set', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: false,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      service.listVolumePlans({
        alias: 'prod',
        availableOnly: true,
        size: '250'
      })
    ).rejects.toMatchObject({
      code: 'UNAVAILABLE_VOLUME_PLAN',
      message: 'Volume size 250 GB is currently unavailable in inventory.'
    });
  });

  it('rejects invalid or conflicting plan data from the API before returning plans', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: 'broken',
        price: 5
      }
    ]);

    await expect(
      service.listVolumePlans({ alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'Volume plan discovery returned an invalid size value.'
    });

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days',
            committed_sku_price: 1000
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 60,
            committed_sku_id: 31,
            committed_sku_name: '60 Days',
            committed_sku_price: 1800
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      service.listVolumePlans({ alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message:
        'Volume plan discovery returned conflicting committed plan details for plan id 31.'
    });
  });

  it('merges identical committed options and preserves null pricing fields safely', async () => {
    const { listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days',
            committed_sku_price: 1000
          }
        ],
        currency: undefined,
        iops: 5000,
        name: '250 GB',
        price: Number.NaN
      },
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days',
            committed_sku_price: 1000
          }
        ],
        currency: undefined,
        iops: 5000,
        name: '250 GB',
        price: Number.NaN
      }
    ]);

    const result = await service.listVolumePlans({ alias: 'prod' });

    expect(result.items).toEqual([
      {
        available: true,
        committed_options: [
          {
            id: 31,
            name: '30 Days',
            savings_percent: null,
            term_days: 30,
            total_price: 1000
          }
        ],
        currency: null,
        hourly_price: null,
        iops: 5000,
        size_gb: 250
      }
    ]);
  });
});

describe('VolumeService.createVolume — edge cases', () => {
  it('creates hourly volumes without committed-plan metadata', async () => {
    const { createVolume, listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.5,
        committed_sku: [],
        currency: 'INR',
        iops: 7000,
        name: '500 GB',
        price: '6'
      }
    ]);
    createVolume.mockResolvedValue({
      id: 55,
      image_name: 'data-hourly'
    });

    const result = await service.createVolume({
      alias: 'prod',
      billingType: 'hourly',
      name: ' data-hourly ',
      size: '500'
    });

    expect(createVolume).toHaveBeenCalledWith({
      iops: 7000,
      name: 'data-hourly',
      size: 500
    });
    expect(result).toEqual({
      action: 'create',
      billing: {
        committed_plan: null,
        post_commit_behavior: null,
        type: 'hourly'
      },
      requested: {
        name: 'data-hourly',
        size_gb: 500
      },
      resolved_plan: {
        available: true,
        currency: 'INR',
        hourly_price: 4.11,
        iops: 7000,
        size_gb: 500
      },
      volume: {
        id: 55,
        name: 'data-hourly'
      }
    });
  });

  it('defaults committed post-commit behavior to auto-renew when omitted', async () => {
    const { createVolume, listVolumePlans, service } = createServiceFixture();

    listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 1,
        committed_sku: [
          {
            committed_days: 60,
            committed_sku_id: 91,
            committed_sku_name: undefined,
            committed_sku_price: 2000
          }
        ],
        currency: undefined,
        iops: 15000,
        name: '1 TB',
        price: ''
      }
    ]);
    createVolume.mockResolvedValue({
      id: 88,
      image_name: 'data-committed'
    });

    const result = await service.createVolume({
      alias: 'prod',
      billingType: 'committed',
      committedPlanId: '91',
      name: 'data-committed',
      size: '1000'
    });

    expect(createVolume).toHaveBeenCalledWith({
      cn_id: 91,
      cn_status: 'auto_renew',
      iops: 15000,
      name: 'data-committed',
      size: 1000
    });
    expect(result.billing).toEqual({
      committed_plan: {
        id: 91,
        name: '60 Days Committed',
        savings_percent: null,
        term_days: 60,
        total_price: 2000
      },
      post_commit_behavior: 'auto-renew',
      type: 'committed'
    });
    expect(result.resolved_plan).toEqual({
      available: true,
      currency: null,
      hourly_price: null,
      iops: 15000,
      size_gb: 1000
    });
  });

  it.each([
    [
      'rejects committed plan ids on hourly billing',
      {
        billingType: 'hourly',
        code: 'UNEXPECTED_COMMITTED_PLAN_ID',
        options: { committedPlanId: '31' }
      }
    ],
    [
      'rejects post-commit behavior on hourly billing',
      {
        billingType: 'hourly',
        code: 'UNEXPECTED_POST_COMMIT_BEHAVIOR',
        options: { postCommitBehavior: 'auto-renew' }
      }
    ],
    [
      'rejects invalid billing types',
      {
        billingType: 'weekly',
        code: 'INVALID_BILLING_TYPE',
        options: {}
      }
    ],
    [
      'rejects invalid post-commit behavior values',
      {
        billingType: 'committed',
        code: 'INVALID_POST_COMMIT_BEHAVIOR',
        options: {
          committedPlanId: '31',
          postCommitBehavior: 'pause'
        }
      }
    ],
    [
      'rejects empty names',
      {
        billingType: 'hourly',
        code: 'EMPTY_REQUIRED_VALUE',
        options: { name: '   ' }
      }
    ],
    [
      'rejects blank sizes',
      {
        billingType: 'hourly',
        code: 'EMPTY_REQUIRED_VALUE',
        options: { size: '   ' }
      }
    ],
    [
      'rejects non-numeric sizes',
      {
        billingType: 'hourly',
        code: 'INVALID_NUMERIC_VALUE',
        options: { size: '25GB' }
      }
    ],
    [
      'rejects zero sizes',
      {
        billingType: 'hourly',
        code: 'INVALID_NUMERIC_VALUE',
        options: { size: '0' }
      }
    ],
    [
      'rejects blank committed plan ids',
      {
        billingType: 'committed',
        code: 'EMPTY_REQUIRED_VALUE',
        options: { committedPlanId: '   ' }
      }
    ],
    [
      'rejects non-numeric committed plan ids',
      {
        billingType: 'committed',
        code: 'INVALID_NUMERIC_VALUE',
        options: { committedPlanId: 'plan-31' }
      }
    ]
  ])('%s', async (_title, scenario) => {
    const { service } = createServiceFixture();

    await expect(
      service.createVolume({
        alias: 'prod',
        billingType: scenario.billingType,
        name: 'vol-a',
        size: '250',
        ...(scenario.options ?? {})
      })
    ).rejects.toMatchObject({
      code: scenario.code
    });
  });

  it('rejects missing, ambiguous, unavailable, and invalid committed plan selections', async () => {
    const missing = createServiceFixture();
    missing.listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      missing.service.createVolume({
        alias: 'prod',
        billingType: 'hourly',
        name: 'vol-a',
        size: '500'
      })
    ).rejects.toMatchObject({
      code: 'VOLUME_PLAN_NOT_FOUND'
    });

    const ambiguous = createServiceFixture();
    ambiguous.listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      },
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 6000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      ambiguous.service.createVolume({
        alias: 'prod',
        billingType: 'hourly',
        name: 'vol-a',
        size: '250'
      })
    ).rejects.toMatchObject({
      code: 'AMBIGUOUS_VOLUME_PLAN'
    });

    const unavailable = createServiceFixture();
    unavailable.listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: false,
        bs_size: 0.25,
        committed_sku: [],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      unavailable.service.createVolume({
        alias: 'prod',
        billingType: 'hourly',
        name: 'vol-a',
        size: '250'
      })
    ).rejects.toMatchObject({
      code: 'UNAVAILABLE_VOLUME_PLAN'
    });

    const invalidCommitted = createServiceFixture();
    invalidCommitted.listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: [
          {
            committed_days: 30,
            committed_sku_id: 31,
            committed_sku_name: '30 Days',
            committed_sku_price: 1000
          }
        ],
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 5
      }
    ]);

    await expect(
      invalidCommitted.service.createVolume({
        alias: 'prod',
        billingType: 'committed',
        committedPlanId: '99',
        name: 'vol-a',
        size: '250'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_COMMITTED_PLAN_ID'
    });
  });
});

describe('VolumeService normalization details', () => {
  it('normalizes optional list/detail fields when attachment and size metadata are missing', async () => {
    const { getVolume, listVolumes, service } = createServiceFixture();

    listVolumes.mockResolvedValueOnce({
      items: [
        {
          block_id: 41,
          name: 'list-no-size',
          size_string: undefined,
          status: 'Available',
          vm_detail: undefined
        }
      ],
      total_count: undefined,
      total_page_number: 1
    });
    getVolume.mockResolvedValue({
      block_id: 42,
      is_block_storage_exporting_to_eos: undefined,
      name: 'detail-with-tb',
      size_string: '1.5 TB',
      snapshot_exist: undefined,
      status: 'Detached',
      vm_detail: {
        node_id: null,
        vm_id: null,
        vm_name: '   '
      }
    });

    const listResult = await service.listVolumes({ alias: 'prod' });
    const getResult = await service.getVolume('42', { alias: 'prod' });

    expect(listResult.total_count).toBe(1);
    expect(listResult.items[0]).toEqual({
      attached: false,
      attachment: null,
      id: 41,
      name: 'list-no-size',
      size_gb: null,
      size_label: null,
      status: 'Available'
    });
    expect(getResult.volume).toEqual({
      attached: false,
      attachment: null,
      exporting_to_eos: false,
      id: 42,
      name: 'detail-with-tb',
      size_gb: 1500,
      size_label: '1.5 TB',
      snapshot_exists: false,
      status: 'Detached'
    });
  });

  it('handles invalid volume ids, invalid size labels, and non-numeric plan prices defensively', async () => {
    const invalidIdFixture = createServiceFixture();
    await expect(
      invalidIdFixture.service.getVolume('abc', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_VOLUME_ID'
    });

    const listFixture = createServiceFixture();
    listFixture.listVolumes.mockResolvedValueOnce({
      items: [
        {
          block_id: 43,
          name: 'invalid-size',
          size_string: '500 MB',
          status: 'Available',
          vm_detail: {}
        }
      ],
      total_count: 1,
      total_page_number: 1
    });
    const listResult = await listFixture.service.listVolumes({ alias: 'prod' });

    expect(listResult.items[0]?.size_gb).toBeNull();

    const plansFixture = createServiceFixture();
    plansFixture.listVolumePlans.mockResolvedValue([
      {
        available_inventory_status: true,
        bs_size: 0.25,
        committed_sku: undefined,
        currency: 'INR',
        iops: 5000,
        name: '250 GB',
        price: 'not-a-number'
      }
    ]);
    const plansResult = await plansFixture.service.listVolumePlans({
      alias: 'prod'
    });

    expect(plansResult.items).toEqual([
      {
        available: true,
        committed_options: [],
        currency: 'INR',
        hourly_price: null,
        iops: 5000,
        size_gb: 250
      }
    ]);
  });
});
