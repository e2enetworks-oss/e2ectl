import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node catalog os against a fake MyAccount API', () => {
  it('renders deterministic json from the compiled CLI', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/os-category/': () => ({
        body: {
          code: 200,
          data: {
            category_list: [
              {
                OS: 'Ubuntu',
                category: ['Linux Virtual Node'],
                version: [
                  {
                    number_of_domains: null,
                    os: 'Ubuntu',
                    software_version: '',
                    sub_category: 'Ubuntu',
                    version: '24.04'
                  }
                ]
              }
            ]
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'node', 'catalog', 'os'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'catalog-os',
          entries: [
            {
              category: 'Ubuntu',
              display_category: 'Linux Virtual Node',
              number_of_domains: null,
              os: 'Ubuntu',
              os_version: '24.04',
              software_version: ''
            }
          ]
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/os-category/',
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
