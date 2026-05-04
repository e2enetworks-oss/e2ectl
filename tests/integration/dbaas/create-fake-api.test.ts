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

      expect(server.requests).toHaveLength(3);
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
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates a committed VPC-attached DBaaS from stdin password input', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': (request) => ({
        body: {
          code: 200,
          data:
            request.query.software_id === '401'
              ? {
                  database_engines: [],
                  template_plans: [
                    {
                      available_inventory_status: true,
                      committed_sku: [
                        {
                          committed_days: 365,
                          committed_sku_id: 7701,
                          committed_sku_name: 'Balanced Small - 1 year',
                          committed_sku_price: 32000
                        }
                      ],
                      cpu: '4',
                      currency: 'INR',
                      disk: '200 GB',
                      name: 'Balanced Small',
                      price_per_hour: 18,
                      ram: '16 GB',
                      software: {
                        engine: 'Relational',
                        id: 401,
                        name: 'PostgreSQL',
                        version: '16'
                      },
                      template_id: 990
                    }
                  ]
                }
              : {
                  database_engines: [
                    {
                      engine: 'Relational',
                      id: 401,
                      name: 'PostgreSQL',
                      version: '16'
                    }
                  ],
                  template_plans: []
                },
          errors: {},
          message: 'OK'
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
      'POST /myaccount/api/v1/rds/cluster/': () => ({
        body: {
          code: 201,
          data: {
            cluster_id: 9901,
            name: 'analytics-db'
          },
          errors: {},
          message: 'Created Successfully'
        },
        status: 201
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'dbaas',
          'create',
          '--name',
          'analytics-db',
          '--type',
          'postgres',
          '--db-version',
          '16',
          '--plan',
          'Balanced Small',
          '--database-name',
          'analytics',
          '--username',
          'appuser',
          '--password-file',
          '-',
          '--billing-type',
          'committed',
          '--committed-plan-id',
          '7701',
          '--committed-renewal',
          'hourly',
          '--vpc-id',
          '501',
          '--subnet-id',
          '44',
          '--no-public-ip'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          },
          stdin: 'ValidPassword1!A\n'
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Created DBaaS');
      expect(result.stdout).toContain('analytics-db');
      expect(result.stdout).toContain('Committed Plan ID');
      expect(result.stdout).toContain('7701');
      expect(result.stdout).toContain('VPC ID');
      expect(result.stdout).toContain('501');

      expect(server.requests).toHaveLength(4);
      expect(server.requests[2]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/vpc/501/'
      });
      expect(JSON.parse(server.requests[3]!.body)).toEqual({
        cn_id: 7701,
        cn_status: 'hourly_billing',
        database: {
          dbaas_number: 1,
          name: 'analytics',
          password: 'ValidPassword1!A',
          user: 'appuser'
        },
        name: 'analytics-db',
        public_ip_required: false,
        software_id: 401,
        template_id: 990,
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
