import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas plans against a fake MyAccount API', () => {
  it('lists supported engine versions in deterministic json mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': () => ({
        body: {
          code: 200,
          data: {
            database_engines: [
              {
                description: 'General purpose PostgreSQL',
                engine: 'Relational',
                id: 401,
                name: 'PostgreSQL',
                version: '16'
              },
              {
                engine: 'Distributed',
                id: 999,
                name: 'YugaByte',
                version: '2.0'
              }
            ],
            template_plans: []
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'dbaas', 'types'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'types',
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
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders supported engine versions in human mode with type sorting', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': () => ({
        body: {
          code: 200,
          data: {
            database_engines: [
              {
                engine: 'Relational',
                id: 301,
                name: 'MySQL',
                version: '8.0'
              },
              {
                engine: 'Relational',
                id: 201,
                name: 'MariaDB',
                version: '11.4'
              },
              {
                engine: 'Relational',
                id: 202,
                name: 'MariaDB',
                version: '10.6'
              },
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
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['dbaas', 'types'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Supported DBaaS engine types (4)');
      expect(result.stdout).toContain('MariaDB');
      expect(result.stdout).toContain('MySQL');
      expect(result.stdout).toContain('PostgreSQL');
      expect(result.stdout.indexOf('11.4')).toBeLessThan(
        result.stdout.indexOf('10.6')
      );
      expect(result.stdout).toContain(
        'e2ectl dbaas plans --type <database-type> --db-version <version>'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lists template plans for one supported engine version', async () => {
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
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['dbaas', 'plans', '--type', 'postgres', '--db-version', '16'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Plans for PostgreSQL 16 (1)');
      expect(result.stdout).toContain('Balanced Small');
      expect(result.stdout).toContain('Template ID');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('returns committed SKU options in deterministic json mode', async () => {
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
                      available_inventory_status: false,
                      committed_sku: [
                        {
                          committed_days: 365,
                          committed_sku_id: 9002,
                          committed_sku_name: 'Balanced Large - 1 year',
                          committed_sku_price: 64000
                        }
                      ],
                      cpu: '8',
                      currency: 'INR',
                      disk: '500 GB',
                      name: 'Balanced Large',
                      price_per_hour: 48,
                      ram: '32 GB',
                      software: {
                        engine: 'Relational',
                        id: 401,
                        name: 'PostgreSQL',
                        version: '16'
                      },
                      template_id: 992
                    },
                    {
                      available_inventory_status: true,
                      committed_sku: [
                        {
                          committed_days: 365,
                          committed_sku_id: 9001,
                          committed_sku_name: 'Balanced Small - 1 year',
                          committed_sku_price: 32000
                        },
                        {
                          committed_days: 30,
                          committed_sku_name: 'Missing id is ignored',
                          committed_sku_price: 4000
                        }
                      ],
                      cpu: '4',
                      currency: 'INR',
                      disk: '200 GB',
                      name: 'Balanced Small',
                      price: '18',
                      ram: '16 GB',
                      software: {
                        engine: 'Relational',
                        id: 401,
                        name: 'PostgreSQL',
                        version: '16'
                      },
                      template_id: 990
                    },
                    {
                      available_inventory_status: true,
                      committed_sku: [],
                      cpu: '2',
                      currency: null,
                      disk: '100 GB',
                      name: 'Starter',
                      price: 'not-a-number',
                      ram: '8 GB',
                      software: {
                        engine: 'Relational',
                        id: 401,
                        name: 'PostgreSQL',
                        version: '16'
                      },
                      template_id: 989
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
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'dbaas',
          'plans',
          '--type',
          'postgres',
          '--db-version',
          '16'
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
          action: 'plans',
          filters: {
            type: 'PostgreSQL',
            version: '16'
          },
          items: [
            {
              available: true,
              committed_sku: [
                {
                  committed_days: 365,
                  committed_sku_id: 9001,
                  committed_sku_name: 'Balanced Small - 1 year',
                  committed_sku_price: 32000,
                  currency: 'INR'
                }
              ],
              currency: 'INR',
              disk: '200 GB',
              name: 'Balanced Small',
              price_per_hour: 18,
              ram: '16 GB',
              template_id: 990,
              type: 'PostgreSQL',
              vcpu: '4',
              version: '16'
            },
            {
              available: true,
              committed_sku: [],
              currency: null,
              disk: '100 GB',
              name: 'Starter',
              price_per_hour: null,
              ram: '8 GB',
              template_id: 989,
              type: 'PostgreSQL',
              vcpu: '2',
              version: '16'
            },
            {
              available: false,
              committed_sku: [
                {
                  committed_days: 365,
                  committed_sku_id: 9002,
                  committed_sku_name: 'Balanced Large - 1 year',
                  committed_sku_price: 64000,
                  currency: 'INR'
                }
              ],
              currency: 'INR',
              disk: '500 GB',
              name: 'Balanced Large',
              price_per_hour: 48,
              ram: '32 GB',
              template_id: 992,
              type: 'PostgreSQL',
              vcpu: '8',
              version: '16'
            }
          ],
          total_count: 3
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders empty plan results clearly in human mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': (request) => ({
        body: {
          code: 200,
          data:
            request.query.software_id === '201'
              ? {
                  database_engines: [],
                  template_plans: []
                }
              : {
                  database_engines: [
                    {
                      engine: 'Relational',
                      id: 201,
                      name: 'MariaDB',
                      version: '11.4'
                    }
                  ],
                  template_plans: []
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
        ['dbaas', 'plans', '--type', 'maria', '--db-version', '11.4'],
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
        'Plans for MariaDB 11.4 (0)\nNo DBaaS plans found.\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
