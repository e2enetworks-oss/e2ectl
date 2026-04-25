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

  it('renders human set-default output', () => {
    const output = renderConfigResult(
      {
        action: 'set-default',
        alias: 'prod',
        config: {
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          },
          default: 'prod'
        }
      },
      false
    );

    expect(output).toBe('Set "prod" as the default profile.\n');
  });

  it('renders human removed output', () => {
    const output = renderConfigResult(
      {
        action: 'removed',
        alias: 'staging',
        config: { profiles: {} }
      },
      false
    );

    expect(output).toBe('Removed profile "staging".\n');
  });

  it('renders human set-context output', () => {
    const output = renderConfigResult(
      {
        action: 'set-context',
        alias: 'prod',
        config: {
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          },
          default: 'prod'
        }
      },
      false
    );

    expect(output).toBe('Updated default context for "prod".\n');
  });

  it('renders empty list message when no profiles are saved', () => {
    const output = renderConfigResult(
      { action: 'list', config: { profiles: {} } },
      false
    );

    expect(output).toBe('No profiles saved.\n');
  });

  it('renders human list output with profile table when profiles exist', () => {
    const output = renderConfigResult(
      {
        action: 'list',
        config: {
          default: 'prod',
          profiles: {
            prod: {
              api_key: 'api-key',
              auth_token: 'auth-token',
              default_location: 'Delhi',
              default_project_id: '42'
            }
          }
        }
      },
      false
    );

    expect(output).toContain('prod');
    expect(output).toContain('Delhi');
  });

  it('renders human imported output with new default and saved defaults', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          default: 'prod',
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod'],
        importedDefaults: {
          default_location: 'Delhi',
          default_project_id: '42'
        },
        previousDefault: undefined
      },
      false
    );

    expect(output).toContain('Imported 1 profile from "/tmp/creds.json".');
    expect(output).toContain('Saved aliases: prod.');
    expect(output).toContain('Set "prod" as the default profile.');
    expect(output).toContain('Saved default project ID "42"');
    expect(output).toContain('Saved default location "Delhi"');
  });

  it('renders human imported output with same-default message', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          default: 'prod',
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod'],
        importedDefaults: {},
        previousDefault: 'prod'
      },
      false
    );

    expect(output).toContain('Default profile remains "prod".');
  });

  it('renders human imported output with no-default message', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod'],
        importedDefaults: {},
        previousDefault: undefined
      },
      false
    );

    expect(output).toContain('No default profile was set.');
  });

  it('renders plural profile noun in imported success message', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          profiles: {
            prod: { api_key: 'k1', auth_token: 't1' },
            staging: { api_key: 'k2', auth_token: 't2' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod', 'staging'],
        importedDefaults: {},
        previousDefault: undefined
      },
      false
    );

    expect(output).toContain('Imported 2 profiles from "/tmp/creds.json".');
  });

  it('renders deterministic json for imported action', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          default: 'prod',
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod'],
        importedDefaults: {
          default_location: 'Delhi',
          default_project_id: '42'
        },
        previousDefault: undefined
      },
      true
    );

    const parsed = JSON.parse(output) as {
      action: string;
      imported_aliases: string[];
      imported_count: number;
      saved_default_location: string;
      saved_default_project_id: string;
    };
    expect(parsed.action).toBe('imported');
    expect(parsed.imported_aliases).toEqual(['prod']);
    expect(parsed.imported_count).toBe(1);
    expect(parsed.saved_default_location).toBe('Delhi');
    expect(parsed.saved_default_project_id).toBe('42');
  });

  it('renders empty string for non-default profile in table', () => {
    const config: ConfigFile = {
      profiles: {
        prod: { api_key: 'prod-key', auth_token: 'prod-token' },
        staging: { api_key: 'stag-key', auth_token: 'stag-token' }
      },
      default: 'prod'
    };

    const summary = summarizeProfiles(config);
    const table = formatProfilesTable(summary);

    expect(table).toContain('prod');
    expect(table).toContain('staging');
    expect(table).toContain('yes');
    expect(table).not.toMatch(/staging.*yes/);
  });

  it('renders null for missing importedDefaults fields in json imported output', () => {
    const output = renderConfigResult(
      {
        action: 'imported',
        config: {
          default: 'prod',
          profiles: {
            prod: { api_key: 'api-key', auth_token: 'auth-token' }
          }
        },
        filePath: '/tmp/creds.json',
        importedAliases: ['prod'],
        importedDefaults: {},
        previousDefault: undefined
      },
      true
    );

    const parsed = JSON.parse(output) as {
      saved_default_location: null;
      saved_default_project_id: null;
    };
    expect(parsed.saved_default_location).toBeNull();
    expect(parsed.saved_default_project_id).toBeNull();
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
