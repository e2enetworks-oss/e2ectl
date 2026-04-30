import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas get/network/whitelist against a fake MyAccount API', () => {
  it('shows detailed DBaaS network fields in json and human output', async () => {
    await withDbaasNetworkApi(async ({ env }) => {
      const getResult = await runBuiltCli(['--json', 'dbaas', 'get', '7869'], {
        env
      });
      const humanGetResult = await runBuiltCli(['dbaas', 'get', '7869'], {
        env
      });
      const networkShowResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', '7869', 'show'],
        { env }
      );
      const humanNetworkShowResult = await runBuiltCli(
        ['dbaas', 'network', '7869', 'show'],
        { env }
      );

      expect(getResult.exitCode).toBe(0);
      expect(getResult.stderr).toBe('');
      expect(getResult.stdout).toBe(
        `${stableStringify({
          action: 'get',
          dbaas: {
            connection_endpoint: 'db.example.com (1.2.3.4)',
            connection_port: '3306',
            connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
            created_at: '2026-04-24T12:00:00.000Z',
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
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
            status: 'Running',
            type: 'MySQL',
            username: 'admin',
            version: '8.0',
            vpc_connections: [
              {
                appliance_id: 7869,
                ip_address: '10.40.0.8',
                subnet_id: 44,
                vpc_cidr: '10.40.0.0/16',
                vpc_id: 501,
                vpc_name: 'app-vpc'
              }
            ],
            whitelisted_ips: [
              {
                ip: '203.0.113.10'
              }
            ]
          }
        })}\n`
      );

      expect(humanGetResult.exitCode).toBe(0);
      expect(humanGetResult.stdout).toContain('Plan');
      expect(humanGetResult.stdout).toContain('DBS.16GB');
      expect(humanGetResult.stdout).toContain('Price');
      expect(humanGetResult.stdout).toContain('150 INR');
      expect(humanGetResult.stdout).toContain('Configuration');
      expect(humanGetResult.stdout).toContain('4 vCPU, 16 GB RAM, 100 GB disk');
      expect(humanGetResult.stdout).toContain('VPC Connections:');
      expect(humanGetResult.stdout).toContain('Whitelisted IPs:');
      expect(networkShowResult.exitCode).toBe(0);
      expect(networkShowResult.stdout).toBe(
        `${stableStringify({
          action: 'network-show',
          dbaas_id: 7869,
          network: {
            connection_endpoint: 'db.example.com (1.2.3.4)',
            connection_port: '3306',
            public_ip: {
              attached: true,
              enabled: true,
              ip_address: '1.2.3.4'
            },
            vpc_connections: [
              {
                appliance_id: 7869,
                ip_address: '10.40.0.8',
                subnet_id: 44,
                vpc_cidr: '10.40.0.0/16',
                vpc_id: 501,
                vpc_name: 'app-vpc'
              }
            ]
          }
        })}\n`
      );
      expect(humanNetworkShowResult.exitCode).toBe(0);
      expect(humanNetworkShowResult.stdout).toContain('Network');
      expect(humanNetworkShowResult.stdout).toContain('Public IP Attached');
      expect(humanNetworkShowResult.stdout).toContain('VPC Connections:');
      expect(humanNetworkShowResult.stdout).not.toContain('Whitelisted IPs');
    });
  });

  it('falls back to nested whitelist data and empty network sections', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/9901/': () => ({
        body: {
          code: 200,
          data: {
            created_at: null,
            id: 9901,
            master_node: {
              allowed_ip_address: {
                whitelisted_ips: ['203.0.113.20', ' ', '198.51.100.0/24']
              },
              cluster_id: 9901,
              database: {
                database: '',
                id: 21,
                pg_detail: {}
              },
              domain: 'null',
              plan: {
                cpu: '2',
                disk: '100 GB',
                name: 'Starter',
                price: null,
                price_per_hour: null,
                price_per_month: null,
                ram: '8 GB'
              },
              private_ip_address: null,
              public_ip_address: null,
              public_port: ''
            },
            name: 'private-db',
            software: {
              engine: 'Relational',
              id: 401,
              name: 'PostgreSQL',
              version: '16'
            },
            status: 'provisioning',
            status_title: ''
          },
          errors: {},
          message: 'OK'
        }
      }),
      'GET /myaccount/api/v1/rds/cluster/9901/vpc/': () => ({
        body: {
          code: 200,
          data: [],
          errors: {},
          message: 'OK'
        }
      }),
      'GET /myaccount/api/v1/rds/cluster/9901/public-ip-status/': () => ({
        body: {
          code: 200,
          data: {
            public_ip_status: false
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const env = {
        HOME: tempHome.path,
        [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
      };

      const jsonResult = await runBuiltCli(['--json', 'dbaas', 'get', '9901'], {
        env
      });
      const humanResult = await runBuiltCli(['dbaas', 'get', '9901'], { env });

      expect(jsonResult.exitCode).toBe(0);
      expect(jsonResult.stderr).toBe('');
      expect(jsonResult.stdout).toBe(
        `${stableStringify({
          action: 'get',
          dbaas: {
            connection_endpoint: null,
            connection_port: null,
            connection_string: null,
            created_at: null,
            database_name: null,
            id: 9901,
            name: 'private-db',
            plan: {
              configuration: {
                cpu: '2',
                disk: '100 GB',
                ram: '8 GB'
              },
              name: 'Starter',
              price: null,
              price_per_hour: null,
              price_per_month: null
            },
            public_ip: {
              attached: false,
              enabled: false,
              ip_address: null
            },
            status: null,
            type: 'PostgreSQL',
            username: null,
            version: '16',
            vpc_connections: [],
            whitelisted_ips: [
              {
                ip: '203.0.113.20'
              },
              {
                ip: '198.51.100.0/24'
              }
            ]
          }
        })}\n`
      );
      expect(humanResult.exitCode).toBe(0);
      expect(humanResult.stdout).toContain('VPC Connections: none');
      expect(humanResult.stdout).toContain('Whitelisted IPs:');
      expect(humanResult.stdout).toContain('203.0.113.20');
      expect(humanResult.stdout).toContain('198.51.100.0/24');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lists, adds, and removes whitelisted DBaaS IPs with the expected payload', async () => {
    await withDbaasNetworkApi(async ({ env, server }) => {
      const whitelistListResult = await runBuiltCli(
        ['dbaas', 'whitelist', '7869', 'list'],
        { env }
      );
      const whitelistListJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'whitelist', '7869', 'list'],
        { env }
      );
      const whitelistAddResult = await runBuiltCli(
        ['--json', 'dbaas', 'whitelist', '7869', 'add', '203.0.113.10'],
        { env }
      );
      const whitelistAddHumanResult = await runBuiltCli(
        ['dbaas', 'whitelist', '7869', 'add', '203.0.113.10'],
        { env }
      );
      const whitelistRemoveResult = await runBuiltCli(
        ['dbaas', 'whitelist', '7869', 'remove', '203.0.113.10'],
        { env }
      );

      expect(whitelistListResult.exitCode).toBe(0);
      expect(whitelistListResult.stdout).toContain('Whitelisted IPs');
      expect(whitelistListResult.stdout).toContain('203.0.113.10');
      expect(whitelistListJsonResult.exitCode).toBe(0);
      expect(whitelistListJsonResult.stdout).toContain(
        '"action": "whitelist-list"'
      );
      expect(whitelistAddResult.exitCode).toBe(0);
      expect(whitelistAddResult.stdout).toContain('"action": "whitelist-add"');
      expect(whitelistAddHumanResult.exitCode).toBe(0);
      expect(whitelistAddHumanResult.stdout).toContain(
        'Whitelisted IP 203.0.113.10 for DBaaS 7869.'
      );
      expect(whitelistAddHumanResult.stdout).toContain(
        'Message: IP whitelisting in progress.'
      );
      expect(whitelistRemoveResult.exitCode).toBe(0);
      expect(whitelistRemoveResult.stdout).toContain(
        'Removed whitelisted IP 203.0.113.10 from DBaaS 7869.'
      );

      const whitelistAddRequest = server.requests.find(
        (request) =>
          request.method === 'PUT' &&
          request.query.action === 'attach' &&
          request.pathname.endsWith('/update-allowed-hosts')
      );
      const whitelistRemoveRequest = server.requests.find(
        (request) =>
          request.method === 'PUT' &&
          request.query.action === 'detach' &&
          request.pathname.endsWith('/update-allowed-hosts')
      );

      expect(JSON.parse(whitelistAddRequest!.body)).toEqual({
        allowed_hosts: [{ ip: '203.0.113.10', tag: [] }]
      });
      expect(JSON.parse(whitelistRemoveRequest!.body)).toEqual({
        allowed_hosts: [{ ip: '203.0.113.10', tag: [] }]
      });
    });
  });

  it('attaches and detaches DBaaS public IPs through the expected endpoints', async () => {
    await withDbaasNetworkApi(async ({ env, server }) => {
      const attachPublicIpResult = await runBuiltCli(
        ['dbaas', 'network', '7869', 'attach-public-ip'],
        { env }
      );
      const attachPublicIpJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', '7869', 'attach-public-ip'],
        { env }
      );
      const detachPublicIpResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', '7869', 'detach-public-ip', '--force'],
        { env }
      );
      const detachPublicIpHumanResult = await runBuiltCli(
        ['dbaas', 'network', '7869', 'detach-public-ip', '--force'],
        { env }
      );

      expect(attachPublicIpResult.exitCode).toBe(0);
      expect(attachPublicIpResult.stdout).toContain(
        'Public IP attach requested for DBaaS 7869.'
      );
      expect(attachPublicIpJsonResult.exitCode).toBe(0);
      expect(attachPublicIpJsonResult.stdout).toContain(
        '"action": "public-ip-attach"'
      );
      expect(detachPublicIpResult.exitCode).toBe(0);
      expect(detachPublicIpResult.stdout).toContain(
        '"action": "public-ip-detach"'
      );
      expect(detachPublicIpHumanResult.exitCode).toBe(0);
      expect(detachPublicIpHumanResult.stdout).toContain(
        'Public IP detach requested for DBaaS 7869.'
      );
      expect(detachPublicIpHumanResult.stdout).toContain(
        'Message: Public IP detach initiated.'
      );

      const publicIpAttachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/public-ip-attach/')
      );
      const publicIpDetachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/public-ip-detach/')
      );

      expect(publicIpAttachRequest?.pathname).toBe(
        '/myaccount/api/v1/rds/cluster/7869/public-ip-attach/'
      );
      expect(publicIpDetachRequest?.pathname).toBe(
        '/myaccount/api/v1/rds/cluster/7869/public-ip-detach/'
      );
    });
  });

  it('attaches and detaches VPCs with resolved VPC metadata', async () => {
    await withDbaasNetworkApi(async ({ env, server }) => {
      const attachVpcResult = await runBuiltCli(
        ['dbaas', 'network', '7869', 'attach-vpc', '501'],
        { env }
      );
      const attachVpcJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', '7869', 'attach-vpc', '501'],
        { env }
      );
      const detachVpcResult = await runBuiltCli(
        ['dbaas', 'network', '7869', 'detach-vpc', '501', '--subnet-id', '44'],
        { env }
      );
      const detachVpcJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', '7869', 'detach-vpc', '501'],
        { env }
      );

      expect(attachVpcResult.exitCode).toBe(0);
      expect(attachVpcResult.stdout).toContain(
        'Attached VPC 501 (app-vpc) to DBaaS 7869.'
      );
      expect(attachVpcJsonResult.exitCode).toBe(0);
      expect(attachVpcJsonResult.stdout).toContain('"action": "vpc-attach"');
      expect(detachVpcResult.exitCode).toBe(0);
      expect(detachVpcResult.stdout).toContain(
        'Detached VPC 501 (app-vpc) from DBaaS 7869.'
      );
      expect(detachVpcResult.stdout).toContain('Subnet ID: 44');
      expect(detachVpcJsonResult.exitCode).toBe(0);
      expect(detachVpcJsonResult.stdout).toContain('"action": "vpc-detach"');

      const vpcAttachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/vpc-attach/')
      );
      const vpcDetachWithSubnetRequest = server.requests.find(
        (request) =>
          request.pathname.endsWith('/vpc-detach/') &&
          request.body.includes('"subnet_id"')
      );

      expect(JSON.parse(vpcAttachRequest!.body)).toEqual({
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
      expect(JSON.parse(vpcDetachWithSubnetRequest!.body)).toEqual({
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
    });
  });
});

async function withDbaasNetworkApi(
  test: (context: {
    env: Record<string, string>;
    server: Awaited<ReturnType<typeof startTestHttpServer>>;
  }) => Promise<void>
): Promise<void> {
  const server = await startTestHttpServer({
    'GET /myaccount/api/v1/rds/cluster/7869/': () => ({
      body: {
        code: 200,
        data: {
          created_at: '2026-04-24T12:00:00.000Z',
          id: 7869,
          master_node: {
            cluster_id: 7869,
            cpu: '4',
            database: {
              database: 'appdb',
              id: 11,
              pg_detail: {},
              username: 'admin'
            },
            disk: '100 GB',
            domain: 'db.example.com',
            plan: {
              name: 'DBS.16GB',
              price: '150 INR',
              price_per_hour: 5,
              price_per_month: 3600,
              ram: '16 GB'
            },
            port: '3306',
            private_ip_address: '10.0.0.10',
            public_ip_address: '1.2.3.4',
            public_port: 3306,
            ram: '16 GB'
          },
          name: 'customer-db',
          software: {
            engine: 'Relational',
            id: 301,
            name: 'MySQL',
            version: '8.0'
          },
          status: 'active',
          status_title: 'Running',
          whitelisted_ips: [
            {
              ip: '203.0.113.10'
            }
          ]
        },
        errors: {},
        message: 'OK'
      }
    }),
    'GET /myaccount/api/v1/rds/cluster/7869/vpc/': () => ({
      body: {
        code: 200,
        data: [
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
        ],
        errors: {},
        message: 'OK'
      }
    }),
    'GET /myaccount/api/v1/rds/cluster/7869/public-ip-status/': () => ({
      body: {
        code: 200,
        data: {
          public_ip_status: true
        },
        errors: {},
        message: 'OK'
      }
    }),
    'GET /myaccount/api/v1/rds/cluster/7869/update-allowed-hosts': () => ({
      body: {
        code: 200,
        data: [
          {
            ip: '203.0.113.10'
          }
        ],
        errors: {},
        message: 'OK',
        total_count: 1,
        total_page_number: 1
      }
    }),
    'PUT /myaccount/api/v1/rds/cluster/7869/update-allowed-hosts': () => ({
      body: {
        code: 200,
        data: {},
        errors: {},
        message: 'IP whitelisting in progress.'
      }
    }),
    'PUT /myaccount/api/v1/rds/cluster/7869/public-ip-attach/': () => ({
      body: {
        code: 200,
        data: {},
        errors: {},
        message: 'Public IP attach initiated.'
      }
    }),
    'PUT /myaccount/api/v1/rds/cluster/7869/public-ip-detach/': () => ({
      body: {
        code: 200,
        data: {},
        errors: {},
        message: 'Public IP detach initiated.'
      }
    }),
    'GET /myaccount/api/v1/vpc/501/': () => ({
      body: {
        code: 200,
        data: {
          ipv4_cidr: '10.40.0.0/16',
          is_e2e_vpc: true,
          name: 'app-vpc',
          network_id: 501,
          state: 'Active'
        },
        errors: {},
        message: 'OK'
      }
    }),
    'PUT /myaccount/api/v1/rds/cluster/7869/vpc-attach/': () => ({
      body: {
        code: 200,
        data: {},
        errors: {},
        message: 'VPC attach initiated.'
      }
    }),
    'PUT /myaccount/api/v1/rds/cluster/7869/vpc-detach/': () => ({
      body: {
        code: 200,
        data: {},
        errors: {},
        message: 'VPC detach initiated.'
      }
    })
  });
  const tempHome = await createTempHome();

  try {
    await seedDefaultProfile(tempHome);
    await test({
      env: {
        HOME: tempHome.path,
        [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
      },
      server
    });
  } finally {
    await server.close();
    await tempHome.cleanup();
  }
}
