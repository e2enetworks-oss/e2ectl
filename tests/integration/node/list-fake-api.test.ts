import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node list against a fake MyAccount API', () => {
  it('uses the compiled CLI, saved defaults, and real transport path', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/': () => ({
        body: {
          code: 200,
          data: [
            {
              id: 205,
              is_locked: false,
              name: 'node-b',
              plan: 'C3.16GB',
              private_ip_address: '10.0.0.2',
              public_ip_address: '1.1.1.2',
              status: 'Running'
            },
            {
              id: 101,
              is_locked: false,
              name: 'node-a',
              plan: 'C3.8GB',
              private_ip_address: '10.0.0.1',
              public_ip_address: '1.1.1.1',
              status: 'Running'
            }
          ],
          errors: {},
          message: 'OK',
          total_count: 2,
          total_page_number: 1
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'node', 'list'], {
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
          nodes: [
            {
              id: 101,
              is_locked: false,
              name: 'node-a',
              plan: 'C3.8GB',
              private_ip_address: '10.0.0.1',
              public_ip_address: '1.1.1.1',
              status: 'Running'
            },
            {
              id: 205,
              is_locked: false,
              name: 'node-b',
              plan: 'C3.16GB',
              private_ip_address: '10.0.0.2',
              public_ip_address: '1.1.1.2',
              status: 'Running'
            }
          ],
          total_count: 2,
          total_page_number: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/',
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

  it('surfaces inconsistent backend auth errors through the real transport path', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/': () => ({
        body: {
          detail: 'Authentication credentials were not provided.'
        },
        status: 403
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['node', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(3);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: MyAccount API request failed: Authentication credentials were not provided.\n' +
          '\n' +
          'Details:\n' +
          '- HTTP status: 403 Forbidden\n' +
          '- Path: /nodes/\n' +
          '- Detail: Authentication credentials were not provided.\n' +
          '\n' +
          'Next step: Verify the saved token and API key, then run the command again.\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
