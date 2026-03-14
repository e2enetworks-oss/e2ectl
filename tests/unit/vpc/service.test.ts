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

function createServiceFixture(): {
  createVpc: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  listVpcPlans: ReturnType<typeof vi.fn>;
  listVpcs: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: VpcService;
} {
  const createVpc = vi.fn();
  const listVpcPlans = vi.fn();
  const listVpcs = vi.fn();
  let credentials: ResolvedCredentials | undefined;

  const client: VpcClient = {
    attachNodeVpc: vi.fn(),
    createVpc,
    detachNodeVpc: vi.fn(),
    listVpcPlans,
    listVpcs
  };
  const createVpcClient = vi.fn((resolvedCredentials: ResolvedCredentials) => {
    credentials = resolvedCredentials;
    return client;
  });
  const service = new VpcService({
    createVpcClient,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    createVpc,
    createVpcClient,
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
      subnet_count: 1
    });
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
        name: 'prod-vpc',
        network_id: 27835,
        project_id: '46429',
        vpc_id: 3956
      }
    });
  });

  it('separates hourly and committed plan options and matches frontend hourly derivation', async () => {
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
        effective_price_per_hour: 3.56,
        id: 91,
        name: '90 Days',
        term_days: 90,
        total_price: 7800
      }
    ]);
  });
});
