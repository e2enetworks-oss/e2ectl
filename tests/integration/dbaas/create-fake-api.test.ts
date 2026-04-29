import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas create against a fake MyAccount API', () => {
  it('resolves software and template ids before creating a supported DBaaS cluster', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': (request) => ({
        body: {
          code: 200,
          data:
            request.query.software_id === '301'
              ? {
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
                }
              : {
                  database_engines: [
                    {
                      engine: 'Relational',
                      id: 301,
                      name: 'MySQL',
                      version: '8.0'
                    }
                  ],
                  template_plans: []
                },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/rds/cluster/': () => ({
        body: {
          code: 201,
          data: {
            id: 7869,
            name: 'customer-db'
          },
          errors: {},
          message: 'Created Successfully'
        },
        status: 201
      }),
      'GET /myaccount/api/v1/rds/cluster/7869/': () => ({
        body: {
          code: 200,
          data: {
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
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'dbaas',
          'create',
          '--name',
          'customer-db',
          '--type',
          'sql',
          '--db-version',
          '8.0',
          '--plan',
          'General Purpose Small',
          '--database-name',
          'appdb',
          '--password',
          'ValidPassword1!A'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
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
        })}\n`
      );

      expect(server.requests).toHaveLength(4);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/rds/plans/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(server.requests[1]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/rds/plans/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429',
          software_id: '301'
        }
      });
      expect(server.requests[2]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/rds/cluster/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[2]!.body)).toEqual({
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
      expect(server.requests[3]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/rds/cluster/7869/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
