import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { VpcService } from '../../../src/vpc/service.js';
import type { VpcClient } from '../../../src/vpc/index.js';

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
  createVpc: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  deleteVpc: ReturnType<typeof vi.fn>;
  getVpc: ReturnType<typeof vi.fn>;
  listVpcPlans: ReturnType<typeof vi.fn>;
  listVpcs: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: VpcService;
} {
  const createVpc = vi.fn();
  const deleteVpc = vi.fn();
  const getVpc = vi.fn();
  const listVpcPlans = vi.fn();
  const listVpcs = vi.fn();
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  let credentials: ResolvedCredentials | undefined;

  const client: VpcClient = {
    attachNodeVpc: vi.fn(),
    createVpc,
    deleteVpc,
    detachNodeVpc: vi.fn(),
    getVpc,
    listVpcPlans,
    listVpcs
  };
  const createVpcClient = vi.fn((resolvedCredentials: ResolvedCredentials) => {
    credentials = resolvedCredentials;
    return client;
  });
  const service = new VpcService({
    confirm,
    createVpcClient,
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
    createVpc,
    createVpcClient,
    deleteVpc,
    getVpc,
    listVpcPlans,
    listVpcs,
    receivedCredentials: () => credentials,
    service
  };
}

describe('VpcService', () => {
  it('collects paginated VPC list data and resolves saved defaults', async () => {
    const { listVpcs, receivedCredentials, service } = createServiceFixture();

    listVpcs
      .mockResolvedValueOnce({
        items: [
          {
            created_at: '2026-03-13T09:00:00Z',
            ipv4_cidr: '10.10.0.0/23',
            is_e2e_vpc: false,
            name: 'vpc-b',
            network_id: 22,
            state: 'Creating',
            subnets: []
          }
        ],
        total_count: 2,
        total_page_number: 2
      })
      .mockResolvedValueOnce({
        items: [
          {
            created_at: '2026-03-13T08:00:00Z',
            ipv4_cidr: '10.20.0.0/23',
            is_e2e_vpc: true,
            name: 'vpc-a',
            network_id: 11,
            state: 'Active',
            subnets: [
              {
                cidr: '10.20.0.128/25',
                id: 9,
                subnet_name: 'subnet-a',
                totalIPs: 126,
                usedIPs: 4
              }
            ],
            vm_count: 2
          }
        ],
        total_count: 2,
        total_page_number: 2
      });

    const result = await service.listVpcs({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(listVpcs).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listVpcs).toHaveBeenNthCalledWith(2, 2, 100);
    expect(result).toMatchObject({
      action: 'list',
      total_count: 2,
      total_page_number: 2
    });
    expect(result.items[1]).toMatchObject({
      cidr_source: 'e2e',
      id: 11,
      subnet_count: 1
    });
  });

  it('gets one VPC through the detail path', async () => {
    const { getVpc, service } = createServiceFixture();

    getVpc.mockResolvedValue({
      created_at: '2026-03-13T08:00:00Z',
      gateway_ip: '10.20.0.1',
      ipv4_cidr: '10.20.0.0/23',
      is_e2e_vpc: true,
      location: 'Delhi',
      name: 'prod-vpc',
      network_id: 27835,
      project_name: 'default-project',
      state: 'Active',
      subnets: [],
      vm_count: 2
    });

    const result = await service.getVpc('27835', { alias: 'prod' });

    expect(getVpc).toHaveBeenCalledWith(27835);
    expect(result).toEqual({
      action: 'get',
      vpc: {
        attached_vm_count: 2,
        cidr: '10.20.0.0/23',
        cidr_source: 'e2e',
        created_at: '2026-03-13T08:00:00Z',
        gateway_ip: '10.20.0.1',
        id: 27835,
        location: 'Delhi',
        name: 'prod-vpc',
        network_id: 27835,
        project_name: 'default-project',
        state: 'Active',
        subnet_count: 0,
        subnets: []
      }
    });
  });

  it('rejects invalid custom CIDR values before making network calls', async () => {
    const { createVpc, service } = createServiceFixture();

    await expect(
      service.createVpc({
        billingType: 'hourly',
        cidr: '10.10.0.1/23',
        cidrSource: 'custom',
        name: 'prod-vpc'
      })
    ).rejects.toMatchObject({
      message: 'CIDR must be a valid IPv4 CIDR block.'
    });
    expect(createVpc).not.toHaveBeenCalled();
  });

  it('requires a CIDR when custom CIDR source is selected', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVpc({
        billingType: 'hourly',
        cidrSource: 'custom',
        name: 'prod-vpc'
      })
    ).rejects.toMatchObject({
      message: 'CIDR is required when --cidr-source custom is used.'
    });
  });

  it('requires a committed plan id for committed VPC billing', async () => {
    const { service } = createServiceFixture();

    await expect(
      service.createVpc({
        billingType: 'committed',
        cidr: '10.10.0.0/23',
        cidrSource: 'custom',
        name: 'prod-vpc'
      })
    ).rejects.toMatchObject({
      message:
        'Committed plan ID is required when --billing-type committed is used.'
    });
  });

  it('maps committed VPC create inputs to the backend request shape', async () => {
    const { createVpc, service } = createServiceFixture();

    createVpc.mockResolvedValue({
      is_credit_sufficient: true,
      network_id: 27835,
      project_id: '46429',
      vpc_id: 3956,
      vpc_name: 'prod-vpc'
    });

    const result = await service.createVpc({
      alias: 'prod',
      billingType: 'committed',
      cidr: '10.10.0.0/23',
      cidrSource: 'custom',
      committedPlanId: '91',
      name: 'prod-vpc',
      postCommitBehavior: 'hourly-billing'
    });

    expect(createVpc).toHaveBeenCalledWith({
      cn_id: 91,
      cn_status: 'hourly_billing',
      ipv4: '10.10.0.0/23',
      is_e2e_vpc: false,
      vpc_name: 'prod-vpc'
    });
    expect(result).toEqual({
      action: 'create',
      billing: {
        committed_plan_id: 91,
        post_commit_behavior: 'hourly-billing',
        type: 'committed'
      },
      cidr: {
        source: 'custom',
        value: '10.10.0.0/23'
      },
      credit_sufficient: true,
      vpc: {
        id: 27835,
        name: 'prod-vpc',
        network_id: 27835,
        project_id: '46429',
        vpc_id: 3956
      }
    });
  });

  it('deletes one VPC with an explicit force flag', async () => {
    const { deleteVpc, service } = createServiceFixture();

    deleteVpc.mockResolvedValue({
      message: 'Delete Vpc Initiated Successfully',
      result: {
        project_id: '46429',
        vpc_id: 27835,
        vpc_name: 'prod-vpc'
      }
    });

    const result = await service.deleteVpc('27835', {
      alias: 'prod',
      force: true
    });

    expect(deleteVpc).toHaveBeenCalledWith(27835);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      message: 'Delete Vpc Initiated Successfully',
      vpc: {
        id: 27835,
        name: 'prod-vpc',
        project_id: '46429'
      }
    });
  });

  it('separates hourly and committed plan options without derived pricing fields', async () => {
    const { listVpcPlans, service } = createServiceFixture();

    listVpcPlans.mockResolvedValue([
      {
        committed_sku: [
          {
            committed_days: 90,
            committed_sku_id: 91,
            committed_sku_name: '90 Days',
            committed_sku_price: 7800
          }
        ],
        currency: 'INR',
        location: 'Delhi',
        name: 'VPC',
        price_per_hour: 4.79,
        price_per_month: 3500
      }
    ]);

    const result = await service.listVpcPlans({ alias: 'prod' });

    expect(result.hourly.items).toEqual([
      {
        currency: 'INR',
        location: 'Delhi',
        name: 'VPC',
        price_per_hour: 4.79,
        price_per_month: 3500
      }
    ]);
    expect(result.committed.items).toEqual([
      {
        currency: 'INR',
        id: 91,
        name: '90 Days',
        term_days: 90,
        total_price: 7800
      }
    ]);
    expect(result.committed.items[0]).not.toHaveProperty(
      'effective_price_per_hour'
    );
  });
});

// ---------------------------------------------------------------------------
// listVpcs pagination — happy paths
// ---------------------------------------------------------------------------

describe('VpcService.listVpcs — happy path', () => {
  it('returns items from a single page when total_page_number is 1', async () => {
    const { listVpcs, service } = createServiceFixture();

    listVpcs.mockResolvedValueOnce({
      items: [
        {
          created_at: '2026-03-13T09:00:00Z',
          ipv4_cidr: '10.10.0.0/23',
          is_e2e_vpc: false,
          name: 'vpc-a',
          network_id: 101,
          state: 'Active',
          subnets: []
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    const result = await service.listVpcs({ alias: 'prod' });

    expect(listVpcs).toHaveBeenCalledTimes(1);
    expect(listVpcs).toHaveBeenCalledWith(1, 100);
    expect(result.action).toBe('list');
    expect(result.total_count).toBe(1);
    expect(result.total_page_number).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 101,
      name: 'vpc-a',
      network_id: 101
    });
  });

  it('concatenates items across two pages in order', async () => {
    const { listVpcs, service } = createServiceFixture();

    listVpcs
      .mockResolvedValueOnce({
        items: [
          {
            created_at: '2026-03-13T09:00:00Z',
            ipv4_cidr: '10.10.0.0/23',
            is_e2e_vpc: false,
            name: 'vpc-page1',
            network_id: 201,
            state: 'Active',
            subnets: []
          }
        ],
        total_count: 2,
        total_page_number: 2
      })
      .mockResolvedValueOnce({
        items: [
          {
            created_at: '2026-03-13T10:00:00Z',
            ipv4_cidr: '10.20.0.0/23',
            is_e2e_vpc: true,
            name: 'vpc-page2',
            network_id: 202,
            state: 'Creating',
            subnets: []
          }
        ],
        total_count: 2,
        total_page_number: 2
      });

    const result = await service.listVpcs({ alias: 'prod' });

    expect(listVpcs).toHaveBeenCalledTimes(2);
    expect(listVpcs).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listVpcs).toHaveBeenNthCalledWith(2, 2, 100);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 201,
      name: 'vpc-page1',
      network_id: 201
    });
    expect(result.items[1]).toMatchObject({
      id: 202,
      name: 'vpc-page2',
      network_id: 202
    });
    expect(result.total_count).toBe(2);
    expect(result.total_page_number).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// listVpcs pagination — edge cases
// ---------------------------------------------------------------------------

describe('VpcService.listVpcs — edge cases', () => {
  it('treats total_page_number: 0 as 1 and fetches exactly one page', async () => {
    const { listVpcs, service } = createServiceFixture();

    listVpcs.mockResolvedValueOnce({
      items: [
        {
          created_at: null,
          ipv4_cidr: '192.168.1.0/24',
          is_e2e_vpc: false,
          name: 'vpc-zero-pages',
          network_id: 301,
          state: 'Active',
          subnets: []
        }
      ],
      total_count: 1,
      total_page_number: 0
    });

    const result = await service.listVpcs({ alias: 'prod' });

    // The service normalises 0 → 1 via `?? 1` so the loop exits after page 1.
    expect(listVpcs).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    // The normalised value is stored as-returned from the API response field.
    expect(result.total_page_number).toBe(0);
  });

  it('treats total_page_number: undefined as 1 and fetches exactly one page', async () => {
    const { listVpcs, service } = createServiceFixture();

    listVpcs.mockResolvedValueOnce({
      items: [
        {
          created_at: null,
          ipv4_cidr: '172.16.0.0/24',
          is_e2e_vpc: false,
          name: 'vpc-no-pages-field',
          network_id: 302,
          state: 'Active',
          subnets: []
        }
      ],
      total_count: 1,
      total_page_number: undefined
    });

    const result = await service.listVpcs({ alias: 'prod' });

    expect(listVpcs).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    // undefined is normalised to 1 internally; the stored value reflects that.
    expect(result.total_page_number).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// listVpcs pagination — guard (VPC_LIST_MAX_PAGES = 500)
// ---------------------------------------------------------------------------

describe('VpcService.listVpcs — pagination guard', () => {
  it('throws CliError with PAGINATION_LIMIT_EXCEEDED when total_page_number exceeds 500', async () => {
    const { listVpcs, service } = createServiceFixture();

    // Every page response claims there are 999 pages, so the loop will never
    // satisfy the exit condition on its own. The guard must fire first.
    listVpcs.mockResolvedValue({
      items: [
        {
          created_at: null,
          ipv4_cidr: '10.0.0.0/24',
          is_e2e_vpc: false,
          name: 'vpc-infinite',
          network_id: 999,
          state: 'Active',
          subnets: []
        }
      ],
      total_count: 99900,
      total_page_number: 999
    });

    await expect(service.listVpcs({ alias: 'prod' })).rejects.toMatchObject({
      code: 'PAGINATION_LIMIT_EXCEEDED',
      name: 'CliError'
    });

    // Must not have fetched more than 500 pages.
    expect(listVpcs.mock.calls.length).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// listVpcs — concurrency / shared-state isolation
// ---------------------------------------------------------------------------

describe('VpcService.listVpcs — concurrency', () => {
  it('resolves 5 parallel calls independently without shared-state corruption', async () => {
    // Each parallel call gets its own service + client fixture so there is no
    // shared mock state between invocations.
    const fixtures = Array.from({ length: 5 }, (_, i) => {
      const { listVpcs, service } = createServiceFixture();

      listVpcs.mockResolvedValueOnce({
        items: [
          {
            created_at: null,
            ipv4_cidr: `10.${i}.0.0/24`,
            is_e2e_vpc: false,
            name: `vpc-concurrent-${i}`,
            network_id: 500 + i,
            state: 'Active',
            subnets: []
          }
        ],
        total_count: 1,
        total_page_number: 1
      });

      return {
        expectedNetworkId: 500 + i,
        expectedName: `vpc-concurrent-${i}`,
        listVpcs,
        service
      };
    });

    const results = await Promise.all(
      fixtures.map(({ service }) => service.listVpcs({ alias: 'prod' }))
    );

    for (const [i, result] of results.entries()) {
      const fixture = fixtures[i]!;
      expect(result.action).toBe('list');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: fixture.expectedNetworkId,
        name: fixture.expectedName,
        network_id: fixture.expectedNetworkId
      });
      // Each underlying client was called exactly once.
      expect(fixture.listVpcs).toHaveBeenCalledTimes(1);
    }
  });
});

describe('VpcService.createVpc — edge cases', () => {
  it('creates e2e hourly VPCs without a custom CIDR and preserves null project ids', async () => {
    const { createVpc, service } = createServiceFixture();

    createVpc.mockResolvedValue({
      is_credit_sufficient: false,
      network_id: 27836,
      project_id: null,
      vpc_id: 3957,
      vpc_name: 'e2e-vpc'
    });

    const result = await service.createVpc({
      alias: 'prod',
      billingType: 'hourly',
      cidrSource: 'e2e',
      name: 'e2e-vpc'
    });

    expect(createVpc).toHaveBeenCalledWith({
      is_e2e_vpc: true,
      vpc_name: 'e2e-vpc'
    });
    expect(result).toEqual({
      action: 'create',
      billing: {
        committed_plan_id: null,
        post_commit_behavior: null,
        type: 'hourly'
      },
      cidr: {
        source: 'e2e',
        value: null
      },
      credit_sufficient: false,
      vpc: {
        id: 27836,
        name: 'e2e-vpc',
        network_id: 27836,
        project_id: null,
        vpc_id: 3957
      }
    });
  });

  it('defaults committed post-commit behavior to auto-renew when omitted', async () => {
    const { createVpc, service } = createServiceFixture();

    createVpc.mockResolvedValue({
      is_credit_sufficient: true,
      network_id: 27837,
      project_id: '46429',
      vpc_id: 3958,
      vpc_name: 'committed-vpc'
    });

    const result = await service.createVpc({
      alias: 'prod',
      billingType: 'committed',
      cidr: '10.30.0.0/23',
      cidrSource: 'custom',
      committedPlanId: '91',
      name: 'committed-vpc'
    });

    expect(createVpc).toHaveBeenCalledWith({
      cn_id: 91,
      cn_status: 'auto_renew',
      ipv4: '10.30.0.0/23',
      is_e2e_vpc: false,
      vpc_name: 'committed-vpc'
    });
    expect(result.billing).toEqual({
      committed_plan_id: 91,
      post_commit_behavior: 'auto-renew',
      type: 'committed'
    });
  });

  it.each([
    [
      'rejects committed plan ids on hourly billing',
      {
        billingType: 'hourly',
        code: 'UNEXPECTED_COMMITTED_PLAN_ID',
        options: { committedPlanId: '91' }
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
      'rejects invalid cidr sources',
      {
        billingType: 'hourly',
        code: 'INVALID_CIDR_SOURCE',
        options: { cidrSource: 'platform' }
      }
    ],
    [
      'rejects invalid post-commit behaviors',
      {
        billingType: 'committed',
        code: 'INVALID_POST_COMMIT_BEHAVIOR',
        options: {
          committedPlanId: '91',
          postCommitBehavior: 'pause'
        }
      }
    ],
    [
      'rejects invalid committed plan ids',
      {
        billingType: 'committed',
        code: 'INVALID_NUMERIC_VALUE',
        options: { committedPlanId: 'plan-91' }
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
      'rejects blank names',
      {
        billingType: 'hourly',
        code: 'EMPTY_REQUIRED_VALUE',
        options: { name: '   ' }
      }
    ]
  ])('%s', async (_title, scenario) => {
    const { service } = createServiceFixture();

    await expect(
      service.createVpc({
        alias: 'prod',
        billingType: scenario.billingType,
        cidrSource: 'custom',
        cidr: '10.10.0.0/23',
        name: 'vpc-a',
        ...(scenario.options ?? {})
      })
    ).rejects.toMatchObject({
      code: scenario.code
    });
  });

  it.each([
    ['rejects cidr on e2e source', '10.10.0.0/23', 'UNEXPECTED_CIDR'],
    ['rejects malformed cidr prefixes', '10.10.0.0/x', 'INVALID_CIDR'],
    ['rejects out-of-range cidr prefixes', '10.10.0.0/40', 'INVALID_CIDR'],
    ['rejects non-network cidr addresses', '10.10.0.1/23', 'INVALID_CIDR'],
    ['rejects extra cidr separators', '10.10.0.0/23/1', 'INVALID_CIDR']
  ])('%s', async (_title, cidr, code) => {
    const { service } = createServiceFixture();

    await expect(
      service.createVpc({
        alias: 'prod',
        billingType: 'hourly',
        cidr,
        cidrSource: cidr === '10.10.0.0/23' ? 'e2e' : 'custom',
        name: 'vpc-a'
      })
    ).rejects.toMatchObject({
      code
    });
  });
});

describe('VpcService.deleteVpc — edge cases', () => {
  it('returns a cancelled result when the delete confirmation is declined', async () => {
    const { confirm, deleteVpc, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteVpc('27835', { alias: 'prod' });

    expect(confirm).toHaveBeenCalledWith(
      'Delete VPC 27835? This cannot be undone.'
    );
    expect(deleteVpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      vpc: {
        id: 27835,
        name: null,
        project_id: null
      }
    });
  });

  it('requires --force when deleting a VPC in a non-interactive terminal', async () => {
    const { confirm, deleteVpc, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteVpc('27835', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a VPC requires confirmation in an interactive terminal.'
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteVpc).not.toHaveBeenCalled();
  });

  it('rejects non-numeric VPC ids before calling the API client', async () => {
    const { deleteVpc, service } = createServiceFixture();

    await expect(
      service.deleteVpc('abc', { alias: 'prod', force: true })
    ).rejects.toMatchObject({
      code: 'INVALID_VPC_ID',
      message: 'VPC ID must be numeric.'
    });
    expect(deleteVpc).not.toHaveBeenCalled();
  });
});

describe('VpcService summary normalization', () => {
  it('normalizes null optional fields and sparse subnet metadata in list/detail responses', async () => {
    const { getVpc, listVpcPlans, listVpcs, service } = createServiceFixture();

    getVpc.mockResolvedValue({
      created_at: null,
      gateway_ip: null,
      ipv4_cidr: '10.50.0.0/24',
      is_e2e_vpc: false,
      location: null,
      name: 'sparse-vpc',
      network_id: 3001,
      project_name: null,
      state: 'Active',
      subnets: [
        {
          cidr: '10.50.0.0/25',
          id: 11,
          subnet_name: 'front',
          totalIPs: undefined,
          usedIPs: undefined
        }
      ],
      vm_count: undefined
    });
    listVpcs.mockResolvedValueOnce({
      items: [
        {
          created_at: null,
          ipv4_cidr: '10.51.0.0/24',
          is_e2e_vpc: false,
          name: 'list-vpc',
          network_id: 3002,
          state: 'Active',
          subnets: []
        }
      ],
      total_count: undefined,
      total_page_number: 1
    });
    listVpcPlans.mockResolvedValue([
      {
        committed_sku: [
          {
            committed_days: 90,
            committed_sku_id: 91,
            committed_sku_name: '90 Days',
            committed_sku_price: 7800
          },
          {
            committed_days: 30,
            committed_sku_id: undefined,
            committed_sku_name: 'broken',
            committed_sku_price: 1200
          }
        ],
        currency: null,
        location: null,
        name: 'VPC',
        price_per_hour: null,
        price_per_month: null
      }
    ]);

    const getResult = await service.getVpc('3001', { alias: 'prod' });
    const listResult = await service.listVpcs({ alias: 'prod' });
    const plansResult = await service.listVpcPlans({ alias: 'prod' });

    expect(getResult.vpc).toEqual({
      attached_vm_count: 0,
      cidr: '10.50.0.0/24',
      cidr_source: 'custom',
      created_at: null,
      gateway_ip: null,
      id: 3001,
      location: null,
      name: 'sparse-vpc',
      network_id: 3001,
      project_name: null,
      state: 'Active',
      subnet_count: 1,
      subnets: [
        {
          cidr: '10.50.0.0/25',
          id: 11,
          name: 'front',
          total_ips: null,
          used_ips: null
        }
      ]
    });
    expect(listResult.total_count).toBe(1);
    expect(plansResult).toEqual({
      action: 'plans',
      committed: {
        default_post_commit_behavior: 'auto-renew',
        items: [
          {
            currency: null,
            id: 91,
            name: '90 Days',
            term_days: 90,
            total_price: 7800
          }
        ],
        supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
      },
      hourly: {
        items: [
          {
            currency: null,
            location: null,
            name: 'VPC',
            price_per_hour: null,
            price_per_month: null
          }
        ]
      }
    });
  });
});
