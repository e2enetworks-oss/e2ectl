import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildListResponse() {
  return {
    code: 200,
    data: [
      {
        appliance_instance: [
          {
            context: {
              lb_mode: 'HTTP',
              lb_type: 'External',
              tcp_backend: []
            }
          }
        ],
        id: 1,
        name: 'my-alb',
        node_detail: {
          public_ip: '1.2.3.4',
          private_ip: '10.0.0.1'
        },
        status: 'RUNNING'
      }
    ],
    errors: {},
    message: 'OK',
    total_count: 1,
    total_page_number: 1
  };
}

describe('lb list against a fake MyAccount API', () => {
  it('renders a clear empty-state message', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/': () => ({
        body: {
          code: 200,
          data: [],
          errors: {},
          message: 'OK',
          total_count: 0,
          total_page_number: 1
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['lb', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No load balancers found.');
      expect(result.stdout).toContain('e2ectl lb plans');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fetches load balancers and emits deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/': () => ({
        body: buildListResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'lb', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        stableStringify({
          action: 'list',
          items: [
            {
              appliance_name: 'my-alb',
              id: 1,
              lb_mode: 'HTTP',
              lb_type: 'external',
              private_ip: '10.0.0.1',
              public_ip: '1.2.3.4',
              public_ip_reserved: false,
              status: 'RUNNING'
            }
          ]
        }) + '\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]!.query).toMatchObject({
        advance_search_string: 'false',
        page_no: '1',
        per_page: '100'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('outputs human-readable table when --json is not passed', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/': () => ({
        body: buildListResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['lb', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my-alb');
      expect(result.stdout).toContain('RUNNING');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
