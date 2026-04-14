import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('security-group get/delete against a fake MyAccount API', () => {
  it('gets one security group through the backend-supported detail path', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/security_group/57358/': () => ({
        body: {
          code: 200,
          data: {
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
              },
              {
                description: '',
                id: 285097,
                network: 'any',
                network_cidr: '--',
                network_size: 1,
                port_range: 'All',
                protocol_name: 'All',
                rule_type: 'Outbound',
                vpc_id: null
              }
            ]
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'security-group', 'get', '57358'],
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
          action: 'get',
          security_group: {
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
              },
              {
                description: '',
                id: 285097,
                network: 'any',
                network_cidr: '--',
                network_size: 1,
                port_range: 'All',
                protocol_name: 'All',
                rule_type: 'Outbound',
                vpc_id: null
              }
            ]
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human security-group detail output for groups without rules', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/security_group/57358/': () => ({
        body: {
          code: 200,
          data: {
            description: 'web ingress',
            id: 57358,
            is_all_traffic_rule: false,
            is_default: false,
            name: 'web-sg',
            rules: []
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['security-group', 'get', '57358'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('ID: 57358');
      expect(result.stdout).toContain('Name: web-sg');
      expect(result.stdout).toContain('No rules found.');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes one security group with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/security_group/57358/': () => ({
        body: {
          code: 200,
          data: {
            name: 'web-sg'
          },
          errors: {},
          message: 'Security Group deleted successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'security-group', 'delete', '57358', '--force'],
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
          action: 'delete',
          cancelled: false,
          message: 'Security Group deleted successfully.',
          security_group: {
            id: 57358,
            name: 'web-sg'
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
