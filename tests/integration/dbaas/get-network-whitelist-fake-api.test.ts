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
      'PUT /myaccount/api/v1/rds/cluster/7869/update-allowed-hosts': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'IP whitelisting in progress.'
        }
      }),
      'PUT /myaccount/api/v1/rds/cluster/7869/public-ip-detach/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Public IP detach initiated.'
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
      expect(JSON.parse(server.requests[3]!.body)).toEqual({
        allowed_hosts: [{ ip: '203.0.113.10', tag: [7] }]
      });
      expect(server.requests[3]?.query).toMatchObject({
        action: 'attach'
      });
      expect(server.requests[4]?.pathname).toBe(
        '/myaccount/api/v1/rds/cluster/7869/public-ip-detach/'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
