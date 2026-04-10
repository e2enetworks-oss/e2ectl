import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node power actions against a fake MyAccount API', () => {
  it('powers on nodes through the node action endpoint', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/101/actions/': () => ({
        body: {
          code: 200,
          data: {
            action_type: 'Power On',
            created_at: '2026-03-14T08:10:00Z',
            id: 701,
            resource_id: '101',
            status: 'In Progress'
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
        ['--json', 'node', 'action', 'power-on', '101'],
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
          action: 'power-on',
          node_id: 101,
          result: {
            action_id: 701,
            created_at: '2026-03-14T08:10:00Z',
            image_id: null,
            status: 'In Progress'
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'PUT',
        pathname: '/myaccount/api/v1/nodes/101/actions/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        type: 'power_on'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('powers off nodes through the node action endpoint', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/101/actions/': () => ({
        body: {
          code: 200,
          data: {
            action_type: 'Power Off',
            created_at: '2026-03-14T08:15:00Z',
            id: 702,
            resource_id: '101',
            status: 'In Progress'
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
        ['--json', 'node', 'action', 'power-off', '101'],
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
          action: 'power-off',
          node_id: 101,
          result: {
            action_id: 702,
            created_at: '2026-03-14T08:15:00Z',
            image_id: null,
            status: 'In Progress'
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        type: 'power_off'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
