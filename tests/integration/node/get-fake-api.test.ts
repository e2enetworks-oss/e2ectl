import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node get against a fake MyAccount API', () => {
  it('uses the compiled CLI and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            created_at: '2026-03-11T10:00:00Z',
            disk: '100 GB',
            id: 101,
            location: 'Delhi',
            memory: '8 GB',
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running',
            vcpus: '4'
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'node', 'get', '101'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'get',
          node: {
            created_at: '2026-03-11T10:00:00Z',
            disk: '100 GB',
            id: 101,
            location: 'Delhi',
            memory: '8 GB',
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running',
            vcpus: '4'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/',
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
