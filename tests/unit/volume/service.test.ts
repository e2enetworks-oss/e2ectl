import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
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

function createServiceFixture(): {
  createVolume: ReturnType<typeof vi.fn>;
  createVolumeClient: ReturnType<typeof vi.fn>;
  listVolumePlans: ReturnType<typeof vi.fn>;
  listVolumes: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: VolumeService;
} {
  const createVolume = vi.fn();
  const listVolumePlans = vi.fn();
  const listVolumes = vi.fn();
  let credentials: ResolvedCredentials | undefined;

  const client: VolumeClient = {
    attachVolumeToNode: vi.fn(),
    createVolume,
    detachVolumeFromNode: vi.fn(),
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
    createVolumeClient,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    createVolume,
    createVolumeClient,
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
