import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { DbaasService } from '../../../src/dbaas/service.js';
import type { DbaasClient } from '../../../src/dbaas/index.js';
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

function createMysqlCluster() {
  return {
    created_at: '2026-04-24T12:00:00.000Z',
    id: 7869,
    master_node: {
      cluster_id: 7869,
      database: {
        database: 'appdb',
        id: 11,
        pg_detail: {},
        username: 'admin'
      },
      domain: 'db.example.com',
      port: '3306',
      private_ip_address: '10.0.0.10',
      public_ip_address: '1.2.3.4',
      public_port: 3306
    },
    name: 'customer-db',
    software: {
      engine: 'Relational',
      id: 301,
      name: 'MySQL',
      version: '8.0'
    },
    status: 'Running',
    status_title: 'Running'
  };
}

function createPostgresCluster() {
  return {
    created_at: '2026-04-24T12:00:00.000Z',
    id: 9901,
    master_node: {
      cluster_id: 9901,
      database: {
        database: 'analytics',
        id: 12,
        pg_detail: {},
        username: 'admin'
      },
      domain: 'pg.example.com',
      port: '5432',
      private_ip_address: '10.0.0.20',
      public_ip_address: '5.6.7.8',
      public_port: 5432
    },
    name: 'analytics-db',
    software: {
      engine: 'Relational',
      id: 401,
      name: 'PostgreSQL',
      version: '16'
    },
    status: 'Running',
    status_title: 'Running'
  };
}

function createServiceFixture(options?: { isInteractive?: boolean }): {
  attachVpc: ReturnType<typeof vi.fn>;
  attachPublicIp: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
  createDbaas: ReturnType<typeof vi.fn>;
  createDbaasClient: ReturnType<typeof vi.fn>;
  deleteDbaas: ReturnType<typeof vi.fn>;
  detachPublicIp: ReturnType<typeof vi.fn>;
  detachVpc: ReturnType<typeof vi.fn>;
  getDbaas: ReturnType<typeof vi.fn>;
  getPublicIpStatus: ReturnType<typeof vi.fn>;
  listDbaas: ReturnType<typeof vi.fn>;
  listPlans: ReturnType<typeof vi.fn>;
  listVpcConnections: ReturnType<typeof vi.fn>;
  listWhitelistedIps: ReturnType<typeof vi.fn>;
  readPasswordFile: ReturnType<typeof vi.fn>;
  readPasswordFromStdin: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  resetPassword: ReturnType<typeof vi.fn>;
  service: DbaasService;
  updateWhitelistedIps: ReturnType<typeof vi.fn>;
  getVpc: ReturnType<typeof vi.fn>;
} {
  const confirm = vi.fn(() => Promise.resolve(true));
  const attachPublicIp = vi.fn();
  const createDbaas = vi.fn();
  const deleteDbaas = vi.fn();
  const detachPublicIp = vi.fn();
  const detachVpc = vi.fn();
  const getDbaas = vi.fn();
  const getPublicIpStatus = vi.fn();
  const listDbaas = vi.fn();
  const listPlans = vi.fn();
  const listVpcConnections = vi.fn();
  const listWhitelistedIps = vi.fn();
  const readPasswordFile = vi.fn();
  const readPasswordFromStdin = vi.fn();
  const resetPassword = vi.fn();
  const updateWhitelistedIps = vi.fn();
  const getVpc = vi.fn(() =>
    Promise.resolve({
      ipv4_cidr: '10.40.0.0/16',
      is_e2e_vpc: true,
      name: 'app-vpc',
      network_id: 501,
      state: 'Active'
    })
  );
  let credentials: ResolvedCredentials | undefined;

  const attachVpc = vi.fn();

  const client: DbaasClient = {
    attachVpc,
    attachPublicIp,
    createDbaas,
    deleteDbaas,
    detachPublicIp,
    detachVpc,
    getDbaas,
    getPublicIpStatus,
    listDbaas,
    listPlans,
    listVpcConnections,
    listWhitelistedIps,
    resetPassword,
    updateWhitelistedIps
  };
  const createDbaasClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    }
  );
  const service = new DbaasService({
    confirm,
    createDbaasClient,
    createVpcClient: () =>
      ({
        attachNodeVpc: vi.fn(),
        createVpc: vi.fn(),
        deleteVpc: vi.fn(),
        detachNodeVpc: vi.fn(),
        getVpc,
        listVpcPlans: vi.fn(),
        listVpcs: vi.fn()
      }) as unknown as VpcClient,
    isInteractive: options?.isInteractive ?? true,
    readPasswordFile,
    readPasswordFromStdin,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    attachVpc,
    attachPublicIp,
    confirm,
    createDbaas,
    createDbaasClient,
    deleteDbaas,
    detachPublicIp,
    detachVpc,
    getDbaas,
    getPublicIpStatus,
    listDbaas,
    listPlans,
    listVpcConnections,
    listWhitelistedIps,
    readPasswordFile,
    readPasswordFromStdin,
    receivedCredentials: () => credentials,
    resetPassword,
    service,
    updateWhitelistedIps,
    getVpc
  };
}

describe('DbaasService', () => {
  it('lists supported DBaaS clusters and filters out unsupported engines', async () => {
    const { listDbaas, receivedCredentials, service } = createServiceFixture();

    listDbaas
      .mockResolvedValueOnce({
        items: [
          createMysqlCluster(),
          {
            id: 10001,
            master_node: {
              cluster_id: 10001,
              database: {
                database: 'ignored',
                id: 99,
                pg_detail: {},
                username: 'admin'
              },
              port: '5433'
            },
            name: 'unsupported-db',
            software: {
              engine: 'Distributed',
              id: 999,
              name: 'YugaByte',
              version: '2.0'
            }
          }
        ],
        total_count: 2,
        total_page_number: 2
      })
      .mockResolvedValueOnce({
        items: [createPostgresCluster()],
        total_count: 2,
        total_page_number: 2
      });

    const result = await service.listDbaas({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(listDbaas).toHaveBeenNthCalledWith(1, 1, 100, {});
    expect(listDbaas).toHaveBeenNthCalledWith(2, 2, 100, {});
    expect(result).toEqual({
      action: 'list',
      filters: {
        type: null
      },
      items: [
        {
          connection_endpoint: 'pg.example.com (5.6.7.8)',
          connection_port: '5432',
          connection_string:
            'psql -h pg.example.com -p 5432 -U admin -d analytics',
          database_name: 'analytics',
          id: 9901,
          name: 'analytics-db',
          public_ip: '5.6.7.8',
          status: 'Running',
          type: 'PostgreSQL',
          version: '16'
        },
        {
          connection_endpoint: 'db.example.com (1.2.3.4)',
          connection_port: '3306',
          connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          public_ip: '1.2.3.4',
          status: 'Running',
          type: 'MySQL',
          version: '8.0'
        }
      ],
      total_count: 2,
      total_page_number: 1
    });
  });

  it('creates supported DBaaS clusters by resolving engine and plan ids first', async () => {
    const { createDbaas, getDbaas, listPlans, service } =
      createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });
    createDbaas.mockResolvedValue({
      id: 7869,
      name: 'customer-db'
    });
    getDbaas.mockResolvedValue(createMysqlCluster());

    const result = await service.createDbaas({
      alias: 'prod',
      databaseName: 'appdb',
      dbVersion: '8.0',
      name: 'customer-db',
      password: 'ValidPassword1!A',
      plan: 'General Purpose Small',
      type: 'sql'
    });

    expect(listPlans).toHaveBeenNthCalledWith(1);
    expect(listPlans).toHaveBeenNthCalledWith(2, 301);
    expect(createDbaas).toHaveBeenCalledWith({
      database: {
        dbaas_number: 1,
        name: 'appdb',
        password: 'ValidPassword1!A',
        user: 'admin'
      },
      name: 'customer-db',
      public_ip_required: true,
      software_id: 301,
      template_id: 901
    });
    expect(getDbaas).toHaveBeenCalledWith(7869);
    expect(result).toEqual({
      action: 'create',
      dbaas: {
        connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        type: 'MySQL',
        username: 'admin',
        version: '8.0'
      },
      requested: {
        billing_type: 'hourly',
        database_name: 'appdb',
        name: 'customer-db',
        plan: 'General Purpose Small',
        public_ip: true,
        template_id: 901,
        type: 'MySQL',
        username: 'admin',
        version: '8.0'
      }
    });
  });

  it('creates a VPC-attached DBaaS with an explicit public IP opt-out', async () => {
    const { createDbaas, getDbaas, getVpc, listPlans, service } =
      createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });
    createDbaas.mockResolvedValue({
      id: 7869,
      name: 'customer-db'
    });
    getDbaas.mockResolvedValue(createMysqlCluster());

    await service.createDbaas({
      alias: 'prod',
      databaseName: 'appdb',
      dbVersion: '8.0',
      name: 'customer-db',
      password: 'ValidPassword1!A',
      plan: 'General Purpose Small',
      publicIp: false,
      type: 'sql',
      vpcId: '501'
    });

    expect(getVpc).toHaveBeenCalledWith(501);
    expect(createDbaas).toHaveBeenCalledWith(
      expect.objectContaining({
        public_ip_required: false,
        vpcs: [
          {
            ipv4_cidr: '10.40.0.0/16',
            network_id: 501,
            target: 'vpcs',
            vpc_name: 'app-vpc'
          }
        ]
      })
    );
  });

  it('gets detailed DBaaS network, whitelist, public IP, and plan information', async () => {
    const { getDbaas, getPublicIpStatus, listVpcConnections, service } =
      createServiceFixture();

    getDbaas.mockResolvedValue({
      ...createMysqlCluster(),
      created_at: '2026-04-24T12:00:00.000Z',
      master_node: {
        ...createMysqlCluster().master_node,
        cpu: '4',
        disk: '100 GB',
        plan: {
          name: 'DBS.16GB',
          price: '150 INR',
          price_per_hour: 5,
          price_per_month: 3600,
          ram: '16 GB'
        },
        ram: '16 GB'
      },
      whitelisted_ips: [
        {
          ip: '203.0.113.10',
          tag_list: [{ id: 7, label_name: 'office' }]
        }
      ]
    });
    listVpcConnections.mockResolvedValue([
      {
        appliance_id: 7869,
        ip_address: '10.40.0.8',
        subnet: 44,
        vpc: {
          ipv4_cidr: '10.40.0.0/16',
          name: 'app-vpc',
          network_id: 501
        }
      }
    ]);
    getPublicIpStatus.mockResolvedValue({ public_ip_status: true });

    const result = await service.getDbaas('7869', { alias: 'prod' });

    expect(result).toMatchObject({
      action: 'get',
      dbaas: {
        connection_endpoint: 'db.example.com (1.2.3.4)',
        connection_port: '3306',
        plan: {
          configuration: {
            cpu: '4',
            disk: '100 GB',
            ram: '16 GB'
          },
          name: 'DBS.16GB',
          price: '150 INR',
          price_per_hour: '5',
          price_per_month: '3600'
        },
        public_ip: {
          attached: true,
          enabled: true,
          ip_address: '1.2.3.4'
        },
        vpc_connections: [
          {
            ip_address: '10.40.0.8',
            subnet_id: 44,
            vpc_id: 501,
            vpc_name: 'app-vpc'
          }
        ],
        whitelisted_ips: [
          {
            ip: '203.0.113.10',
            tags: [{ id: 7, name: 'office' }]
          }
        ]
      }
    });
  });

  it('lists supported DBaaS engine types across all families', async () => {
    const { listPlans, service } = createServiceFixture();

    listPlans.mockResolvedValue({
      database_engines: [
        {
          description: 'General purpose PostgreSQL',
          engine: 'Relational',
          id: 401,
          name: 'PostgreSQL',
          version: '16'
        },
        {
          engine: 'Relational',
          id: 999,
          name: 'YugaByte',
          version: '2.0'
        }
      ],
      template_plans: []
    });

    const result = await service.listTypes({ alias: 'prod' });

    expect(listPlans).toHaveBeenCalledOnce();
    expect(result).toEqual({
      action: 'list-types',
      filters: {
        type: null
      },
      items: [
        {
          description: 'General purpose PostgreSQL',
          engine: 'Relational',
          software_id: 401,
          type: 'PostgreSQL',
          version: '16'
        }
      ],
      total_count: 1
    });
  });

  it('lists template plans for one supported engine version', async () => {
    const { listPlans, service } = createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          {
            engine: 'Relational',
            id: 401,
            name: 'PostgreSQL',
            version: '16'
          }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'Balanced Small',
            price_per_hour: 18,
            ram: '8',
            software: {
              engine: 'Relational',
              id: 401,
              name: 'PostgreSQL',
              version: '16'
            },
            template_id: 990
          }
        ]
      });

    const result = await service.listPlans({
      alias: 'prod',
      dbVersion: '16',
      type: 'postgres'
    });

    expect(result).toEqual({
      action: 'plans',
      filters: {
        type: 'PostgreSQL',
        version: '16'
      },
      items: [
        {
          available: true,
          committed_sku: [],
          currency: 'INR',
          disk: '100 GB',
          name: 'Balanced Small',
          price_per_hour: 18,
          ram: '8',
          template_id: 990,
          type: 'PostgreSQL',
          vcpu: '2',
          version: '16'
        }
      ],
      total_count: 1
    });
  });

  it('lists supported DBaaS engine types for one database family', async () => {
    const { listPlans, service } = createServiceFixture();

    listPlans.mockResolvedValue({
      database_engines: [
        {
          engine: 'Relational',
          id: 401,
          name: 'PostgreSQL',
          version: '16'
        },
        {
          engine: 'Relational',
          id: 402,
          name: 'PostgreSQL',
          version: '15'
        },
        {
          engine: 'Relational',
          id: 301,
          name: 'MySQL',
          version: '8.0'
        }
      ],
      template_plans: []
    });

    const result = await service.listTypes({
      alias: 'prod',
      type: 'postgres'
    });

    expect(result).toEqual({
      action: 'list-types',
      filters: {
        type: 'PostgreSQL'
      },
      items: [
        {
          description: null,
          engine: 'Relational',
          software_id: 401,
          type: 'PostgreSQL',
          version: '16'
        },
        {
          description: null,
          engine: 'Relational',
          software_id: 402,
          type: 'PostgreSQL',
          version: '15'
        }
      ],
      total_count: 2
    });
  });

  it('passes the canonical software type when listing one DBaaS family', async () => {
    const { listDbaas, service } = createServiceFixture();

    listDbaas.mockResolvedValue({
      items: [createMysqlCluster()],
      total_count: 1,
      total_page_number: 1
    });

    await service.listDbaas({
      alias: 'prod',
      type: 'sql'
    });

    expect(listDbaas).toHaveBeenCalledWith(1, 100, {
      softwareType: 'MySQL'
    });
  });

  it('resets passwords using the current DB username from cluster details', async () => {
    const { getDbaas, resetPassword, service } = createServiceFixture();

    getDbaas.mockResolvedValue(createMysqlCluster());
    resetPassword.mockResolvedValue({
      cluster_id: 7869,
      message: 'Password reset request processed successfully.',
      name: 'customer-db'
    });

    const result = await service.resetPassword('7869', {
      alias: 'prod',
      password: 'ValidPassword1!A'
    });

    expect(resetPassword).toHaveBeenCalledWith(7869, {
      password: 'ValidPassword1!A',
      username: 'admin'
    });
    expect(result).toEqual({
      action: 'reset-password',
      dbaas: {
        connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        type: 'MySQL',
        username: 'admin',
        version: '8.0'
      },
      message: 'Password reset request processed successfully.'
    });
  });

  it('manages whitelisted IP add, list, and remove flows', async () => {
    const { listWhitelistedIps, service, updateWhitelistedIps } =
      createServiceFixture();

    updateWhitelistedIps.mockResolvedValue({
      message: 'IP whitelisting in progress.'
    });
    listWhitelistedIps.mockResolvedValue({
      items: [
        {
          ip: '203.0.113.10',
          tag_list: [{ id: 7, label_name: 'office' }]
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    const addResult = await service.addWhitelistedIp('7869', {
      alias: 'prod',
      ip: '203.0.113.10',
      tagId: ['7']
    });
    const listResult = await service.listWhitelistedIps('7869', {
      alias: 'prod'
    });
    const removeResult = await service.removeWhitelistedIp('7869', {
      alias: 'prod',
      ip: '203.0.113.10',
      tagId: ['7']
    });

    expect(updateWhitelistedIps).toHaveBeenNthCalledWith(1, 7869, 'attach', {
      allowed_hosts: [{ ip: '203.0.113.10', tag: [7] }]
    });
    expect(updateWhitelistedIps).toHaveBeenNthCalledWith(2, 7869, 'detach', {
      allowed_hosts: [{ ip: '203.0.113.10', tag: [7] }]
    });
    expect(addResult.action).toBe('whitelist-add');
    expect(removeResult.action).toBe('whitelist-remove');
    expect(listResult.items).toEqual([
      {
        ip: '203.0.113.10',
        tags: [{ id: 7, name: 'office' }]
      }
    ]);
  });

  it('rejects invalid whitelisted IP inputs before calling the API', async () => {
    const { service, updateWhitelistedIps } = createServiceFixture();

    await expect(
      service.addWhitelistedIp('7869', {
        alias: 'prod',
        ip: 'not-an-ip'
      })
    ).rejects.toThrow('IP address must be a valid IPv4 address or CIDR.');

    expect(updateWhitelistedIps).not.toHaveBeenCalled();
  });

  it('detaches VPCs using the same VPC payload shape as attach', async () => {
    const { detachVpc, service } = createServiceFixture();

    detachVpc.mockResolvedValue({
      message: 'VPC detach initiated.'
    });

    const result = await service.detachVpc('7869', {
      alias: 'prod',
      subnetId: '44',
      vpcId: '501'
    });

    expect(detachVpc).toHaveBeenCalledWith(7869, {
      action: 'detach',
      vpcs: [
        {
          ipv4_cidr: '10.40.0.0/16',
          network_id: 501,
          subnet_id: 44,
          target: 'vpcs',
          vpc_name: 'app-vpc'
        }
      ]
    });
    expect(result).toEqual({
      action: 'vpc-detach',
      dbaas_id: 7869,
      message: 'VPC detach initiated.',
      vpc: {
        id: 501,
        name: 'app-vpc',
        subnet_id: 44
      }
    });
  });

  it('attaches VPCs with the backend action payload', async () => {
    const { attachVpc, service } = createServiceFixture();

    attachVpc.mockResolvedValue({
      message: 'VPC attach initiated.'
    });

    const result = await service.attachVpc('7869', {
      alias: 'prod',
      vpcId: '501'
    });

    expect(attachVpc).toHaveBeenCalledWith(7869, {
      action: 'attach',
      vpcs: [
        {
          ipv4_cidr: '10.40.0.0/16',
          network_id: 501,
          target: 'vpcs',
          vpc_name: 'app-vpc'
        }
      ]
    });
    expect(result).toEqual({
      action: 'vpc-attach',
      dbaas_id: 7869,
      vpc: {
        id: 501,
        name: 'app-vpc',
        subnet_id: null
      }
    });
  });

  it('attaches and detaches public IPs with confirmation before detach', async () => {
    const { attachPublicIp, confirm, detachPublicIp, service } =
      createServiceFixture();

    attachPublicIp.mockResolvedValue({
      message: 'Public IP attach initiated.'
    });
    detachPublicIp.mockResolvedValue({
      message: 'Public IP detach initiated.'
    });

    const attachResult = await service.attachPublicIp('7869', {
      alias: 'prod'
    });
    const detachResult = await service.detachPublicIp('7869', {
      alias: 'prod'
    });

    expect(attachPublicIp).toHaveBeenCalledWith(7869);
    expect(confirm).toHaveBeenCalledWith(
      'Detach public IP from DBaaS 7869? External connectivity will be lost.'
    );
    expect(detachPublicIp).toHaveBeenCalledWith(7869);
    expect(attachResult.action).toBe('public-ip-attach');
    expect(detachResult).toEqual({
      action: 'public-ip-detach',
      cancelled: false,
      dbaas_id: 7869,
      message: 'Public IP detach initiated.'
    });
  });

  it('cancels public IP detach when confirmation is declined', async () => {
    const { confirm, detachPublicIp, service } = createServiceFixture();

    confirm.mockResolvedValue(false);

    const result = await service.detachPublicIp('7869', {
      alias: 'prod'
    });

    expect(detachPublicIp).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'public-ip-detach',
      cancelled: true,
      dbaas_id: 7869,
      message: null
    });
  });

  it('reads reset passwords from stdin when --password-file - is used', async () => {
    const { getDbaas, readPasswordFromStdin, resetPassword, service } =
      createServiceFixture();

    getDbaas.mockResolvedValue(createMysqlCluster());
    readPasswordFromStdin.mockResolvedValue('ValidPassword1!A\n');
    resetPassword.mockResolvedValue({
      cluster_id: 7869,
      message: 'Password reset request processed successfully.',
      name: 'customer-db'
    });

    await service.resetPassword('7869', {
      alias: 'prod',
      passwordFile: '-'
    });

    expect(readPasswordFromStdin).toHaveBeenCalledOnce();
    expect(resetPassword).toHaveBeenCalledWith(7869, {
      password: 'ValidPassword1!A',
      username: 'admin'
    });
  });

  it('rejects ambiguous DBaaS password sources', async () => {
    const { createDbaas, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        passwordFile: '-',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow('Use only one password source.');

    expect(createDbaas).not.toHaveBeenCalled();
  });

  it('fails clearly when a supported DBaaS cluster has no resettable username', async () => {
    const { getDbaas, resetPassword, service } = createServiceFixture();

    getDbaas.mockResolvedValue({
      ...createMysqlCluster(),
      master_node: {
        ...createMysqlCluster().master_node,
        database: {
          ...createMysqlCluster().master_node.database,
          username: ''
        }
      }
    });

    await expect(
      service.resetPassword('7869', {
        alias: 'prod',
        password: 'ValidPassword1!A'
      })
    ).rejects.toThrow(
      'DBaaS 7869 does not expose a resettable admin username.'
    );

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('returns a cancelled delete result when the user declines confirmation', async () => {
    const { confirm, getDbaas, service } = createServiceFixture();

    confirm.mockResolvedValue(false);
    getDbaas.mockResolvedValue(createMysqlCluster());

    const result = await service.deleteDbaas('7869', {
      alias: 'prod'
    });

    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      dbaas: {
        connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        type: 'MySQL',
        username: 'admin',
        version: '8.0'
      },
      dbaas_id: 7869
    });
  });

  it('deletes DBaaS clusters immediately when --force is used', async () => {
    const { deleteDbaas, getDbaas, service } = createServiceFixture();

    getDbaas.mockResolvedValue(createMysqlCluster());
    deleteDbaas.mockResolvedValue({
      cluster_id: 7869,
      name: 'customer-db'
    });

    const result = await service.deleteDbaas('7869', {
      alias: 'prod',
      force: true
    });

    expect(deleteDbaas).toHaveBeenCalledWith(7869);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      dbaas: {
        connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        type: 'MySQL',
        username: 'admin',
        version: '8.0'
      },
      dbaas_id: 7869,
      message: 'Deleted customer-db.'
    });
  });

  it('fails clearly when the requested database type is unsupported', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'mongodb'
      })
    ).rejects.toThrow('Unsupported database type "mongodb".');

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('rejects committed billing when --committed-plan-id is not provided', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        billingType: 'committed',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow(
      'Committed plan ID is required when --billing-type committed is used.'
    );

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('requires --force for delete flows in non-interactive terminals', async () => {
    const { deleteDbaas, getDbaas, service } = createServiceFixture({
      isInteractive: false
    });

    getDbaas.mockResolvedValue(createMysqlCluster());

    await expect(
      service.deleteDbaas('7869', {
        alias: 'prod'
      })
    ).rejects.toThrow(
      'Deleting a DBaaS requires confirmation in an interactive terminal.'
    );

    expect(deleteDbaas).not.toHaveBeenCalled();
  });

  it('fails clearly when the create response does not include a usable id', async () => {
    const { createDbaas, getDbaas, listPlans, service } =
      createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });
    createDbaas.mockResolvedValue({});

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow(
      'The DBaaS create response did not include a usable cluster id.'
    );

    expect(getDbaas).not.toHaveBeenCalled();
  });

  it('fails clearly when the requested DB version is not supported', async () => {
    const { createDbaasClient, listPlans, service } = createServiceFixture();

    listPlans.mockResolvedValue({
      database_engines: [
        {
          engine: 'Relational',
          id: 301,
          name: 'MySQL',
          version: '8.0'
        }
      ],
      template_plans: []
    });

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '5.7',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow('No supported MySQL engine matches version 5.7.');

    expect(createDbaasClient).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the requested DBaaS plan is unavailable', async () => {
    const { createDbaas, listPlans, service } = createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: false,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow(
      'DBaaS plan "General Purpose Small" is currently unavailable.'
    );

    expect(createDbaas).not.toHaveBeenCalled();
  });

  it('fails clearly when multiple available plans match the requested plan name', async () => {
    const { createDbaas, listPlans, service } = createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          { engine: 'Relational', id: 301, name: 'MySQL', version: '8.0' }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          },
          {
            available_inventory_status: true,
            cpu: '4',
            currency: 'INR',
            disk: '200 GB',
            name: 'General Purpose Small',
            price_per_hour: 24,
            ram: '8',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 902
          }
        ]
      });

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow(
      'Multiple available DBaaS plans match "General Purpose Small".'
    );

    expect(createDbaas).not.toHaveBeenCalled();
  });

  it('fails clearly when MariaDB version is not supported', async () => {
    const { listPlans, service } = createServiceFixture();

    listPlans.mockResolvedValue({
      database_engines: [
        { engine: 'Relational', id: 201, name: 'MariaDB', version: '10.11' }
      ],
      template_plans: []
    });

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'mydb',
        dbVersion: '10.6',
        name: 'my-cluster',
        password: 'ValidPassword1!A',
        plan: 'Small',
        type: 'maria'
      })
    ).rejects.toThrow('No supported MariaDB engine matches version 10.6.');
  });

  it('fails clearly when PostgreSQL version is not supported', async () => {
    const { listPlans, service } = createServiceFixture();

    listPlans.mockResolvedValue({
      database_engines: [
        { engine: 'Relational', id: 401, name: 'PostgreSQL', version: '16' }
      ],
      template_plans: []
    });

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'mydb',
        dbVersion: '14',
        name: 'my-cluster',
        password: 'ValidPassword1!A',
        plan: 'Small',
        type: 'postgres'
      })
    ).rejects.toThrow('No supported PostgreSQL engine matches version 14.');
  });

  it('fails clearly when neither password nor password-file is provided', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'customer-db',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow('Password is required.');

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('reads the create password from a file when --password-file path is used', async () => {
    const { createDbaas, getDbaas, listPlans, readPasswordFile, service } =
      createServiceFixture();

    readPasswordFile.mockResolvedValue('ValidPassword1!A\n');
    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          { engine: 'Relational', id: 301, name: 'MySQL', version: '8.0' }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });
    createDbaas.mockResolvedValue({ id: 7869, name: 'customer-db' });
    getDbaas.mockResolvedValue(createMysqlCluster());

    await service.createDbaas({
      alias: 'prod',
      databaseName: 'appdb',
      dbVersion: '8.0',
      name: 'customer-db',
      passwordFile: '/secure/path/pass.txt',
      plan: 'General Purpose Small',
      type: 'sql'
    });

    expect(readPasswordFile).toHaveBeenCalledWith('/secure/path/pass.txt');
    expect(createDbaas).toHaveBeenCalled();
  });

  it('rejects a cluster that is not a supported engine in delete', async () => {
    const { deleteDbaas, getDbaas, service } = createServiceFixture();

    getDbaas.mockResolvedValue({
      id: 9999,
      master_node: { cluster_id: 9999 },
      name: 'yugabyte-db',
      software: {
        engine: 'Distributed',
        id: 999,
        name: 'YugaByte',
        version: '2.0'
      },
      status: 'Running'
    });

    await expect(
      service.deleteDbaas('9999', { alias: 'prod', force: true })
    ).rejects.toThrow(
      'DBaaS 9999 is not one of the supported engines (MariaDB, MySQL, PostgreSQL).'
    );

    expect(deleteDbaas).not.toHaveBeenCalled();
  });

  it('uses cluster_id from create response when id field is absent', async () => {
    const { createDbaas, getDbaas, listPlans, service } =
      createServiceFixture();

    listPlans
      .mockResolvedValueOnce({
        database_engines: [
          { engine: 'Relational', id: 301, name: 'MySQL', version: '8.0' }
        ],
        template_plans: []
      })
      .mockResolvedValueOnce({
        database_engines: [],
        template_plans: [
          {
            available_inventory_status: true,
            cpu: '2',
            currency: 'INR',
            disk: '100 GB',
            name: 'General Purpose Small',
            price_per_hour: 12,
            ram: '4',
            software: {
              engine: 'Relational',
              id: 301,
              name: 'MySQL',
              version: '8.0'
            },
            template_id: 901
          }
        ]
      });
    createDbaas.mockResolvedValue({ cluster_id: 7869, name: 'customer-db' });
    getDbaas.mockResolvedValue(createMysqlCluster());

    const result = await service.createDbaas({
      alias: 'prod',
      databaseName: 'appdb',
      dbVersion: '8.0',
      name: 'customer-db',
      password: 'ValidPassword1!A',
      plan: 'General Purpose Small',
      type: 'sql'
    });

    expect(getDbaas).toHaveBeenCalledWith(7869);
    expect(result.dbaas.id).toBe(7869);
  });

  it('rejects names with invalid characters', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'my cluster!',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow('Name must match ^[a-zA-Z0-9-_]{1,128}$.');

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('rejects database names longer than 64 characters', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'a'.repeat(65),
        dbVersion: '8.0',
        name: 'my-cluster',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql'
      })
    ).rejects.toThrow('Database name must be 64 characters or fewer.');

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('rejects usernames with uppercase or special characters', async () => {
    const { createDbaasClient, service } = createServiceFixture();

    await expect(
      service.createDbaas({
        alias: 'prod',
        databaseName: 'appdb',
        dbVersion: '8.0',
        name: 'my-cluster',
        password: 'ValidPassword1!A',
        plan: 'General Purpose Small',
        type: 'sql',
        username: 'Admin-User'
      })
    ).rejects.toThrow(
      'Username must contain only lowercase letters and digits, up to 80 characters.'
    );

    expect(createDbaasClient).not.toHaveBeenCalled();
  });

  it('sorts list items by id as the final tie-breaker', async () => {
    const { listDbaas, service } = createServiceFixture();

    listDbaas.mockResolvedValue({
      items: [
        {
          ...createMysqlCluster(),
          id: 200,
          name: 'same-name'
        },
        {
          ...createMysqlCluster(),
          id: 100,
          name: 'same-name'
        }
      ],
      total_count: 2,
      total_page_number: 1
    });

    const result = await service.listDbaas({ alias: 'prod' });

    expect(result.items[0]?.id).toBe(100);
    expect(result.items[1]?.id).toBe(200);
  });

  it('builds connection strings without a database name for PostgreSQL', async () => {
    const { listDbaas, service } = createServiceFixture();

    listDbaas.mockResolvedValue({
      items: [
        {
          ...createPostgresCluster(),
          master_node: {
            ...createPostgresCluster().master_node,
            database: {
              database: '',
              id: 12,
              pg_detail: {},
              username: 'admin'
            }
          }
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    const result = await service.listDbaas({ alias: 'prod' });

    expect(result.items[0]?.connection_string).toBe(
      'psql -h pg.example.com -p 5432 -U admin'
    );
  });

  it('returns null connection string when cluster has no host', async () => {
    const { listDbaas, service } = createServiceFixture();

    listDbaas.mockResolvedValue({
      items: [
        {
          ...createMysqlCluster(),
          master_node: {
            cluster_id: 7869,
            database: {
              database: 'appdb',
              id: 11,
              pg_detail: {},
              username: 'admin'
            },
            domain: null,
            port: null,
            private_ip_address: null,
            public_ip_address: null,
            public_port: null
          }
        }
      ],
      total_count: 1,
      total_page_number: 1
    });

    const result = await service.listDbaas({ alias: 'prod' });

    expect(result.items[0]?.connection_string).toBeNull();
  });
});
