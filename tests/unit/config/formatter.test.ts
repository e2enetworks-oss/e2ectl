import {
  formatProfilesTable,
  renderConfigResult,
  summarizeProfiles
} from '../../../src/config/formatter.js';
import type { ConfigFile } from '../../../src/config/index.js';

describe('config formatter', () => {
  it('masks secrets in profile summaries and shows alias defaults', () => {
    const config: ConfigFile = {
      profiles: {
        prod: {
          api_key: '12345678',
          auth_token: 'abcdefgh',
          default_project_id: '42',
          default_location: 'Delhi'
        }
      },
      default: 'prod'
    };

    const summary = summarizeProfiles(config);
    const table = formatProfilesTable(summary);

    expect(summary[0]).toMatchObject({
      api_key: '****5678',
      auth_token: '****efgh',
      default_project_id: '42',
      default_location: 'Delhi'
    });
    expect(table).toContain('****5678');
    expect(table).toContain('Default Project ID');
    expect(table).toContain('Default Location');
    expect(table).toContain('Delhi');
  });

  it('keeps masked profile secrets compact even for very long tokens', () => {
    const config: ConfigFile = {
      profiles: {
        prod: {
          api_key: '1234567890abcdef',
          auth_token: 'x'.repeat(2048) + 'hUpk',
          default_project_id: '46429',
          default_location: 'Delhi'
        }
      },
      default: 'prod'
    };

    const summary = summarizeProfiles(config);
    const table = formatProfilesTable(summary);

    expect(summary[0]).toMatchObject({
      api_key: '****cdef',
      auth_token: '****hUpk'
    });
    expect(table).toContain('****hUpk');
    expect(table).not.toContain('*'.repeat(100));
  });

  it('renders deterministic json payloads for config results', () => {
    const output = renderConfigResult(
      {
        action: 'set-default',
        alias: 'prod',
        config: {
          profiles: {
            prod: {
              api_key: 'api-key',
              auth_token: 'auth-token'
            }
          },
          default: 'prod'
        }
      },
      true
    );

    expect(output).toBe(
      '{\n' +
        '  "action": "set-default",\n' +
        '  "default": "prod",\n' +
        '  "profiles": [\n' +
        '    {\n' +
        '      "alias": "prod",\n' +
        '      "api_key": "****-key",\n' +
        '      "auth_token": "****oken",\n' +
        '      "default_location": "",\n' +
        '      "default_project_id": "",\n' +
        '      "isDefault": true\n' +
        '    }\n' +
        '  ]\n' +
        '}\n'
    );
  });
});
