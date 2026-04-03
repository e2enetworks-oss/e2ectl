import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('security-group create/update against a fake MyAccount API', () => {
  it('creates security groups from a rules file', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/security_group/': () => ({
        body: {
          code: 200,
          data: {
            label_id: null,
            resource_type: null
          },
          errors: {},
          message: 'Security Group created successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const rulesFilePath = await tempHome.writeImportFile(
        'rules/security-group.json',
        JSON.stringify(sampleRules(), null, 2)
      );

      const result = await runBuiltCli(
        [
          '--json',
          'security-group',
          'create',
          '--name',
          'web-sg',
          '--rules-file',
          rulesFilePath,
          '--default'
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
          action: 'create',
          message: 'Security Group created successfully.',
          security_group: {
            description: '',
            is_default: true,
            label_id: null,
            name: 'web-sg',
            resource_type: null,
            rule_count: 2
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        default: true,
        description: '',
        name: 'web-sg',
        rules: sampleRules()
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('updates security groups from stdin and preserves the current description when omitted', async () => {
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
      }),
      'PUT /myaccount/api/v1/security_group/57358/': () => ({
        body: {
          code: 200,
          data: '',
          errors: {},
          message: 'Security Group updated successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'security-group',
          'update',
          '57358',
          '--name',
          'web-sg',
          '--rules-file',
          '-'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          },
          stdin: `${JSON.stringify(sampleRules())}\n`
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'update',
          message: 'Security Group updated successfully.',
          security_group: {
            description: 'web ingress',
            id: 57358,
            name: 'web-sg',
            rule_count: 2
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        description: 'web ingress',
        name: 'web-sg',
        rules: sampleRules()
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});

function sampleRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}
