import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('security-group list against a fake MyAccount API', () => {
  it('lists security groups and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/security_group/': () => ({
        body: {
          code: 200,
          data: [
            {
              description: 'web ingress',
              id: 57358,
              is_all_traffic_rule: false,
              is_default: false,
              name: 'web-sg',
              rules: [
                {
                  description: 'ssh',
                  id: 285096,
                  network: 'any',
                  network_cidr: '--',
                  network_size: 1,
                  port_range: '22',
                  protocol_name: 'Custom_TCP',
                  rule_type: 'Inbound',
                  vpc_id: null
                }
              ]
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'security-group', 'list'], {
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
          items: [
            {
              description: 'web ingress',
              id: 57358,
              is_all_traffic_rule: false,
              is_default: false,
              name: 'web-sg',
              rules: [
                {
                  description: 'ssh',
                  id: 285096,
                  network: 'any',
                  network_cidr: '--',
                  network_size: 1,
                  port_range: '22',
                  protocol_name: 'Custom_TCP',
                  rule_type: 'Inbound',
                  vpc_id: null
                }
              ]
            }
          ]
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
