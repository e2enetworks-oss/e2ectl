import {
  buildConnectionPort,
  buildConnectionString,
  normalizeDbaasStatusTitle,
  normalizePlanHourlyPrice,
  normalizeVpcConnectionItem,
  normalizeWhitelistedIps,
  sortDbaasListItems,
  summarizeTemplatePlans
} from '../../../src/dbaas/mappers.js';
import type {
  DbaasClusterDetail,
  DbaasClusterSummary,
  DbaasTemplatePlan,
  DbaasVpcConnection
} from '../../../src/dbaas/types/index.js';

describe('dbaas mappers', () => {
  it('normalizes template plan prices, committed SKUs, and ordering', () => {
    const basePlan = createTemplatePlan({
      cpu: '2',
      currency: 'INR',
      disk: '100 GB',
      ram: '4'
    });

    const result = summarizeTemplatePlans('MySQL', '8.0', [
      {
        ...basePlan,
        available_inventory_status: false,
        name: 'Unavailable',
        price_per_hour: 5,
        template_id: 904
      },
      {
        ...basePlan,
        name: 'Expensive',
        price_per_hour: 30,
        template_id: 903
      },
      {
        ...basePlan,
        committed_sku: [
          {
            committed_days: 365,
            committed_sku_id: 101,
            committed_sku_name: 'Small-1Y'
          },
          { committed_days: 365 }
        ],
        name: 'Zebra',
        price_per_hour: '10' as unknown as number,
        template_id: 902
      },
      {
        ...basePlan,
        name: 'Alpha',
        price_per_hour: 10,
        template_id: 901
      },
      {
        ...basePlan,
        currency: null,
        name: 'NullPrice',
        price: null,
        price_per_hour: null,
        template_id: 905
      }
    ]);

    expect(result.map((item) => item.name)).toEqual([
      'Alpha',
      'Zebra',
      'Expensive',
      'NullPrice',
      'Unavailable'
    ]);
    expect(result[1]?.price_per_hour).toBe(10);
    expect(result[1]?.committed_sku).toEqual([
      {
        committed_days: 365,
        committed_sku_id: 101,
        committed_sku_name: 'Small-1Y',
        committed_sku_price: null,
        currency: 'INR',
        plan_name: 'Zebra',
        template_id: 902
      }
    ]);
    expect(result[3]?.price_per_hour).toBeNull();
  });

  it('normalizes non-parseable plan hourly prices to null', () => {
    expect(
      normalizePlanHourlyPrice(
        createTemplatePlan({
          price_per_hour: 'N/A' as unknown as number
        })
      )
    ).toBeNull();
  });

  it('prefers status_title and falls back to status when blank', () => {
    expect(
      normalizeDbaasStatusTitle({
        status: 'Running',
        status_title: 'Provisioning'
      } as DbaasClusterSummary)
    ).toBe('Provisioning');

    expect(
      normalizeDbaasStatusTitle({
        status: 'Running',
        status_title: ''
      } as DbaasClusterSummary)
    ).toBe('Running');

    expect(
      normalizeDbaasStatusTitle({
        status: '',
        status_title: ''
      } as DbaasClusterSummary)
    ).toBeNull();
  });

  it('sorts list items by name, type, version, then id', () => {
    const result = sortDbaasListItems([
      {
        connection_endpoint: null,
        connection_port: null,
        connection_string: null,
        database_name: null,
        id: 200,
        name: 'same-name',
        private_ips: [],
        public_ip: null,
        status: null,
        type: 'MySQL',
        version: '5.7'
      },
      {
        connection_endpoint: null,
        connection_port: null,
        connection_string: null,
        database_name: null,
        id: 100,
        name: 'same-name',
        private_ips: [],
        public_ip: null,
        status: null,
        type: 'MySQL',
        version: '8.0'
      },
      {
        connection_endpoint: null,
        connection_port: null,
        connection_string: null,
        database_name: null,
        id: 300,
        name: 'same-name',
        private_ips: [],
        public_ip: null,
        status: null,
        type: 'PostgreSQL',
        version: '16'
      }
    ]);

    expect(result.map((item) => item.id)).toEqual([100, 200, 300]);
  });

  it('builds connection strings across PostgreSQL and missing-host edge cases', () => {
    const postgresNode = createPostgresCluster().master_node;

    expect(
      buildConnectionString('PostgreSQL', null, 'admin', postgresNode)
    ).toBe('psql -h pg.example.com -p 5432 -U admin');
    expect(
      buildConnectionString('PostgreSQL', 'analytics', 'admin', {
        ...postgresNode,
        port: null as unknown as string,
        public_port: null as unknown as number
      })
    ).toBe('psql -h pg.example.com -U admin -d analytics');
    expect(
      buildConnectionString('PostgreSQL', null, 'admin', {
        ...postgresNode,
        port: null as unknown as string,
        public_port: null as unknown as number
      })
    ).toBe('psql -h pg.example.com -U admin');
    expect(
      buildConnectionString('MySQL', 'appdb', 'admin', {
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
      })
    ).toBeNull();
  });

  it('normalizes VPC connection and port edge cases', () => {
    const baseConnection: DbaasVpcConnection = {
      appliance_id: 1,
      ip_address: '10.0.0.1',
      subnet: null,
      subnets: [{ id: 44, ipv4_cidr: '10.0.0.0/24' }],
      vpc: { ipv4_cidr: '10.0.0.0/16', name: 'app-vpc', network_id: 501 }
    };
    const { subnets: _subnets, ...connectionWithoutSubnets } = baseConnection;
    void _subnets;

    expect(normalizeVpcConnectionItem(baseConnection).subnet_id).toBe(44);
    expect(
      normalizeVpcConnectionItem({
        ...connectionWithoutSubnets,
        subnet: [44, 55]
      }).subnet_id
    ).toBe(44);
    expect(
      normalizeVpcConnectionItem({
        ...connectionWithoutSubnets,
        subnet: []
      }).subnet_id
    ).toBeNull();
    expect(
      normalizeVpcConnectionItem({
        ...baseConnection,
        subnets: []
      }).subnet_id
    ).toBeNull();
    expect(
      normalizeVpcConnectionItem({
        ...baseConnection,
        appliance_id: NaN
      }).appliance_id
    ).toBeNull();
    const { public_port: _emptyPortPublicPort, ...nodeWithEmptyStringPort } =
      createMysqlCluster().master_node;
    void _emptyPortPublicPort;
    expect(
      buildConnectionPort({ ...nodeWithEmptyStringPort, port: '' })
    ).toBeNull();
    const { public_port: _stringPortPublicPort, ...nodeWithStringPort } =
      createMysqlCluster().master_node;
    void _stringPortPublicPort;
    expect(buildConnectionPort({ ...nodeWithStringPort, port: '3306' })).toBe(
      '3306'
    );
  });

  it('normalizes whitelist shapes returned by the DBaaS API', () => {
    const plainIps = normalizeWhitelistedIps({
      ...createMysqlCluster(),
      whitelisted_ips: [],
      master_node: {
        ...createMysqlCluster().master_node,
        allowed_ip_address: {
          whitelisted_ips: ['10.0.0.5', '', null as unknown as string]
        }
      }
    });
    expect(plainIps).toHaveLength(1);
    expect(plainIps[0]?.ip).toBe('10.0.0.5');

    expect(
      normalizeWhitelistedIps({
        ...createMysqlCluster(),
        whitelisted_ips: [
          {
            ip: '10.0.0.1'
          }
        ]
      })[0]?.ip
    ).toBe('10.0.0.1');

    expect(
      normalizeWhitelistedIps({
        ...createMysqlCluster(),
        whitelisted_ips: [{ ip: '10.0.0.2' }]
      })[0]
    ).toEqual({ ip: '10.0.0.2' });
  });
});

function createMysqlCluster(): DbaasClusterDetail {
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
    status: 'active',
    status_title: 'Running'
  };
}

function createPostgresCluster(): DbaasClusterSummary {
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
    status: 'active',
    status_title: 'Running'
  };
}

function createTemplatePlan(
  overrides: Partial<DbaasTemplatePlan> = {}
): DbaasTemplatePlan {
  return {
    available_inventory_status: true,
    cpu: '2',
    currency: 'INR',
    disk: '100 GB',
    name: 'Small',
    price_per_hour: 12,
    ram: '4',
    software: {
      engine: 'Relational',
      id: 301,
      name: 'MySQL',
      version: '8.0'
    },
    template_id: 901,
    ...overrides
  };
}
