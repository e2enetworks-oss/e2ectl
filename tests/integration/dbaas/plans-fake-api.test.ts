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

      const result = await runBuiltCli(['--json', 'dbaas', 'plans'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'plans',
          filters: {
            type: null,
            version: null
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
          mode: 'engines',
          total_count: 1
        })}\n`
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
});
