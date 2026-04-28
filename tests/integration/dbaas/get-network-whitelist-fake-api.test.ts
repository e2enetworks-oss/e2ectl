import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas get/network/whitelist against a fake MyAccount API', () => {
  it('shows detailed network fields and updates whitelist/public IP endpoints', async () => {
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
            status: 'Running',
            status_title: 'Running',
            whitelisted_ips: [
              {
                ip: '203.0.113.10',
                tag_list: [{ id: 7, label_name: 'office' }]
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
              ip: '203.0.113.10',
              tag_list: [{ id: 7, label_name: 'office' }]
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
      const env = {
        HOME: tempHome.path,
        [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
      };

      const getResult = await runBuiltCli(['--json', 'dbaas', 'get', '7869'], {
        env
      });
      const whitelistResult = await runBuiltCli(
        [
          '--json',
          'dbaas',
          'whitelist',
          'add',
          '7869',
          '--ip',
          '203.0.113.10',
          '--tag-id',
          '7'
        ],
        { env }
      );
      const detachPublicIpResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', 'detach-public-ip', '7869', '--force'],
        { env }
      );
      const humanGetResult = await runBuiltCli(['dbaas', 'get', '7869'], {
        env
      });
      const whitelistListResult = await runBuiltCli(
        ['dbaas', 'whitelist', 'list', '7869'],
        { env }
      );
      const whitelistRemoveResult = await runBuiltCli(
        [
          'dbaas',
          'whitelist',
          'remove',
          '7869',
          '--ip',
          '203.0.113.10',
          '--tag-id',
          '7'
        ],
        { env }
      );
      const attachPublicIpResult = await runBuiltCli(
        ['dbaas', 'network', 'attach-public-ip', '7869'],
        { env }
      );
      const attachVpcResult = await runBuiltCli(
        ['dbaas', 'network', 'attach-vpc', '7869', '--vpc-id', '501'],
        { env }
      );
      const detachVpcResult = await runBuiltCli(
        [
          'dbaas',
          'network',
          'detach-vpc',
          '7869',
          '--vpc-id',
          '501',
          '--subnet-id',
          '44'
        ],
        { env }
      );
      const attachPublicIpJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', 'attach-public-ip', '7869'],
        { env }
      );
      const attachVpcJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', 'attach-vpc', '7869', '--vpc-id', '501'],
        { env }
      );
      const detachVpcJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'network', 'detach-vpc', '7869', '--vpc-id', '501'],
        { env }
      );
      const whitelistListJsonResult = await runBuiltCli(
        ['--json', 'dbaas', 'whitelist', 'list', '7869'],
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
                ip: '203.0.113.10',
                tags: [{ id: 7, name: 'office' }]
              }
            ]
          }
        })}\n`
      );

      expect(whitelistResult.exitCode).toBe(0);
      expect(whitelistResult.stdout).toContain('"action": "whitelist-add"');
      expect(detachPublicIpResult.exitCode).toBe(0);
      expect(detachPublicIpResult.stdout).toContain(
        '"action": "public-ip-detach"'
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
      expect(whitelistListResult.exitCode).toBe(0);
      expect(whitelistListResult.stdout).toContain('203.0.113.10');
      expect(whitelistRemoveResult.exitCode).toBe(0);
      expect(whitelistRemoveResult.stdout).toContain(
        'Removed whitelisted IP 203.0.113.10 from DBaaS 7869.'
      );
      expect(attachPublicIpResult.exitCode).toBe(0);
      expect(attachPublicIpResult.stdout).toContain(
        'Public IP attach requested for DBaaS 7869.'
      );
      expect(attachVpcResult.exitCode).toBe(0);
      expect(attachVpcResult.stdout).toContain(
        'Attached VPC 501 (app-vpc) to DBaaS 7869.'
      );
      expect(detachVpcResult.exitCode).toBe(0);
      expect(detachVpcResult.stdout).toContain(
        'Detached VPC 501 (app-vpc) from DBaaS 7869.'
      );
      expect(detachVpcResult.stdout).toContain('Subnet ID: 44');
      expect(attachPublicIpJsonResult.exitCode).toBe(0);
      expect(attachPublicIpJsonResult.stdout).toContain(
        '"action": "public-ip-attach"'
      );
      expect(attachVpcJsonResult.exitCode).toBe(0);
      expect(attachVpcJsonResult.stdout).toContain('"action": "vpc-attach"');
      expect(detachVpcJsonResult.exitCode).toBe(0);
      expect(detachVpcJsonResult.stdout).toContain('"action": "vpc-detach"');
      expect(whitelistListJsonResult.exitCode).toBe(0);
      expect(whitelistListJsonResult.stdout).toContain(
        '"action": "whitelist-list"'
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
      const publicIpDetachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/public-ip-detach/')
      );
      const vpcAttachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/vpc-attach/')
      );
      const vpcDetachRequest = server.requests.find((request) =>
        request.pathname.endsWith('/vpc-detach/')
      );

      expect(JSON.parse(whitelistAddRequest!.body)).toEqual({
        allowed_hosts: [{ ip: '203.0.113.10', tag: [7] }]
      });
      expect(JSON.parse(whitelistRemoveRequest!.body)).toEqual({
        allowed_hosts: [{ ip: '203.0.113.10', tag: [7] }]
      });
      expect(publicIpDetachRequest?.pathname).toBe(
        '/myaccount/api/v1/rds/cluster/7869/public-ip-detach/'
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
      expect(JSON.parse(vpcDetachRequest!.body)).toEqual({
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
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
