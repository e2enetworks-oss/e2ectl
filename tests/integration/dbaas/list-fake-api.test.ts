import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas list against a fake MyAccount API', () => {
  it('uses the cluster list endpoint and filters unsupported engines from deterministic json output', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/': (request) => ({
        body: {
          code: 200,
          data:
            request.query.page_no === '1'
              ? [
                  {
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
                      public_port: 3306
                    },
                    name: 'customer-db',
                    software: {
                      engine: 'Relational',
                      id: 301,
                      name: 'MySQL',
                      version: '8.0'
                    },
                    status: 'Running'
                  },
                  {
                    id: 9999,
                    master_node: {
                      cluster_id: 9999,
                      database: {
                        database: 'ignored',
                        id: 21,
                        pg_detail: {},
                        username: 'admin'
                      },
                      port: '5433'
                    },
                    name: 'ignored-db',
                    software: {
                      engine: 'Distributed',
                      id: 999,
                      name: 'YugaByte',
                      version: '2.0'
                    },
                    status: 'Running'
                  }
                ]
              : [
                  {
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
                      public_port: 5432
                    },
                    name: 'analytics-db',
                    software: {
                      engine: 'Relational',
                      id: 401,
                      name: 'PostgreSQL',
                      version: '16'
                    },
                    status: 'Running'
                  }
                ],
          errors: {},
          message: 'OK',
          total_count: 3,
          total_page_number: 2
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'dbaas', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'list',
          filters: {
            type: null
          },
          items: [
            {
              connection_endpoint: 'pg.example.com',
              connection_port: '5432',
              connection_string:
                'psql -h pg.example.com -p 5432 -U admin -d analytics',
              database_name: 'analytics',
              id: 9901,
              name: 'analytics-db',
              public_ip: null,
              status: 'Running',
              type: 'PostgreSQL',
              version: '16'
            },
            {
              connection_endpoint: 'db.example.com',
              connection_port: '3306',
              connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
              database_name: 'appdb',
              id: 7869,
              name: 'customer-db',
              public_ip: null,
              status: 'Running',
              type: 'MySQL',
              version: '8.0'
            }
          ],
          total_count: 2,
          total_page_number: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/rds/cluster/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          page_no: '1',
          per_page: '100',
          project_id: '46429'
        }
      });
      expect(server.requests[1]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/rds/cluster/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          page_no: '2',
          per_page: '100',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders a readable list table in human mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/': () => ({
        body: {
          code: 200,
          data: [
            {
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
                public_port: 3306
              },
              name: 'customer-db',
              software: {
                engine: 'Relational',
                id: 301,
                name: 'MySQL',
                version: '8.0'
              },
              status: 'Running'
            }
          ],
          errors: {},
          message: 'OK',
          total_count: 1,
          total_page_number: 1
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['dbaas', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('DB Version');
      expect(result.stdout).toContain('customer-db');
      expect(result.stdout).toContain('Connection Endpoint');
      expect(result.stdout).toContain('db.example.com');
      expect(result.stdout).toContain('3306');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
