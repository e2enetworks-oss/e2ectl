import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

const UPGRADE_PLAN = 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi';
const UPGRADE_IMAGE = 'Ubuntu-24.04-Distro';

describe('node upgrade against a fake MyAccount API', () => {
  it('requests node upgrades through the dedicated lifecycle endpoint and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/upgrade/101': () => ({
        body: {
          code: 200,
          data: {
            location: 'Delhi',
            new_node_image_id: 8802,
            old_node_image_id: 8801,
            vm_id: 100157
          },
          errors: {},
          message: 'Node upgrade initiated'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'upgrade',
          '101',
          '--plan',
          UPGRADE_PLAN,
          '--image',
          UPGRADE_IMAGE,
          '--force'
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
          action: 'upgrade',
          details: {
            location: 'Delhi',
            new_node_image_id: 8802,
            old_node_image_id: 8801,
            vm_id: 100157
          },
          message: 'Node upgrade initiated',
          node_id: 101,
          requested: {
            image: UPGRADE_IMAGE,
            plan: UPGRADE_PLAN
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'PUT',
        pathname: '/myaccount/api/v1/nodes/upgrade/101',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });

      const requestBody = JSON.parse(server.requests[0]!.body);

      expect(requestBody).toEqual({
        image: UPGRADE_IMAGE,
        plan: UPGRADE_PLAN
      });
      expect(requestBody).not.toHaveProperty('vm_id');
      expect(requestBody).not.toHaveProperty('committed_id');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails before network in non-interactive mode when upgrade omits --force', async () => {
    const server = await startTestHttpServer({});
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'upgrade',
          '101',
          '--plan',
          UPGRADE_PLAN,
          '--image',
          UPGRADE_IMAGE
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Upgrading a node requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
      );
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('preserves downgrade wording from the backend exactly', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/upgrade/101': () => ({
        body: {
          code: 200,
          data: {
            location: 'Delhi',
            new_node_image_id: 8802,
            old_node_image_id: 8801,
            vm_id: 100157
          },
          errors: {},
          message: 'Node downgrade initiated'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'upgrade',
          '101',
          '--plan',
          UPGRADE_PLAN,
          '--image',
          UPGRADE_IMAGE,
          '--force'
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
          action: 'upgrade',
          details: {
            location: 'Delhi',
            new_node_image_id: 8802,
            old_node_image_id: 8801,
            vm_id: 100157
          },
          message: 'Node downgrade initiated',
          node_id: 101,
          requested: {
            image: UPGRADE_IMAGE,
            plan: UPGRADE_PLAN
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('propagates backend validation blockers through the real transport path', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/upgrade/101': () => ({
        body: {
          code: 412,
          data: {},
          errors: {
            detail: [
              'Action not allowed on Resources that are part of Disaster Recovery Plan'
            ]
          },
          message:
            'Action not allowed on Resources that are part of Disaster Recovery Plan'
        },
        status: 412
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'upgrade',
          '101',
          '--plan',
          UPGRADE_PLAN,
          '--image',
          UPGRADE_IMAGE,
          '--force'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'Error: MyAccount API request failed: Action not allowed on Resources that are part of Disaster Recovery Plan\n'
      );
      expect(result.stderr).toContain(
        '- HTTP status: 412 Precondition Failed\n'
      );
      expect(result.stderr).toContain('- Path: /nodes/upgrade/101\n');
      expect(result.stderr).toContain(
        'Next step: Check the request inputs and try again.\n'
      );
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
