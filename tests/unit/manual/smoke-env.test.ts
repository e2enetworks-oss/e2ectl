import { readSmokeEnv } from '../../manual/helpers/smoke-env.js';

describe('smoke env parsing', () => {
  it('aggregates missing required base and smoke env vars', () => {
    expect(() => {
      readSmokeEnv({});
    }).toThrow(
      'Manual smoke requires E2E_API_KEY, E2E_AUTH_TOKEN, E2E_PROJECT_ID, E2E_LOCATION, E2ECTL_SMOKE_NODE_PLAN, E2ECTL_SMOKE_NODE_IMAGE, E2ECTL_SMOKE_DNS_DOMAIN, E2ECTL_SMOKE_UPGRADE_PLAN, E2ECTL_SMOKE_UPGRADE_IMAGE, E2ECTL_SMOKE_DNS_CREATE_DOMAIN. Missing: E2E_API_KEY, E2E_AUTH_TOKEN, E2E_PROJECT_ID, E2E_LOCATION, E2ECTL_SMOKE_NODE_PLAN, E2ECTL_SMOKE_NODE_IMAGE, E2ECTL_SMOKE_DNS_DOMAIN, E2ECTL_SMOKE_UPGRADE_PLAN, E2ECTL_SMOKE_UPGRADE_IMAGE, E2ECTL_SMOKE_DNS_CREATE_DOMAIN.'
    );
  });

  it('normalizes the smoke-specific env contract', () => {
    const result = readSmokeEnv({
      E2ECTL_SMOKE_DNS_CREATE_DOMAIN: ' disposable.example.net ',
      E2ECTL_MYACCOUNT_BASE_URL: ' https://api.example.test ',
      E2ECTL_SMOKE_DNS_DOMAIN: ' release.example.com ',
      E2ECTL_SMOKE_MANIFEST: ' ./tmp/manual-smoke.json ',
      E2ECTL_SMOKE_NODE_IMAGE: ' ubuntu-24.04 ',
      E2ECTL_SMOKE_NODE_PLAN: ' C3.8GB ',
      E2ECTL_SMOKE_PREFIX: ' Release Smoke / Demo ',
      E2ECTL_SMOKE_RECORD_TTL: ' 600 ',
      E2ECTL_SMOKE_UPGRADE_IMAGE: ' ubuntu-24.04-v2 ',
      E2ECTL_SMOKE_UPGRADE_PLAN: ' C3.16GB ',
      E2E_API_KEY: ' smoke-api-key ',
      E2E_AUTH_TOKEN: ' smoke-auth-token ',
      E2E_LOCATION: ' Delhi ',
      E2E_PROJECT_ID: ' 46429 '
    });

    expect(result.cliEnv).toEqual({
      E2ECTL_MYACCOUNT_BASE_URL: 'https://api.example.test',
      E2E_API_KEY: 'smoke-api-key',
      E2E_AUTH_TOKEN: 'smoke-auth-token',
      E2E_LOCATION: 'Delhi',
      E2E_PROJECT_ID: '46429'
    });
    expect(result.dnsCreateDomain).toBe('disposable.example.net');
    expect(result.dnsDomain).toBe('release.example.com');
    expect(result.manifestPath).toBe('./tmp/manual-smoke.json');
    expect(result.nodeImage).toBe('ubuntu-24.04');
    expect(result.nodePlan).toBe('C3.8GB');
    expect(result.prefix).toBe('release-smoke-demo');
    expect(result.recordTtl).toBe('600');
    expect(result.upgradeImage).toBe('ubuntu-24.04-v2');
    expect(result.upgradePlan).toBe('C3.16GB');
  });

  it('rejects invalid smoke TTL values', () => {
    expect(() => {
      readSmokeEnv({
        E2ECTL_SMOKE_DNS_CREATE_DOMAIN: 'disposable.example.net',
        E2ECTL_SMOKE_DNS_DOMAIN: 'release.example.com',
        E2ECTL_SMOKE_NODE_IMAGE: 'ubuntu-24.04',
        E2ECTL_SMOKE_NODE_PLAN: 'C3.8GB',
        E2ECTL_SMOKE_RECORD_TTL: '0',
        E2ECTL_SMOKE_UPGRADE_IMAGE: 'ubuntu-24.04-v2',
        E2ECTL_SMOKE_UPGRADE_PLAN: 'C3.16GB',
        E2E_API_KEY: 'smoke-api-key',
        E2E_AUTH_TOKEN: 'smoke-auth-token',
        E2E_LOCATION: 'Delhi',
        E2E_PROJECT_ID: '46429'
      });
    }).toThrow(
      'E2ECTL_SMOKE_RECORD_TTL must be a positive integer when it is set.'
    );
  });

  it('rejects upgrade targets that do not change plan or image', () => {
    expect(() => {
      readSmokeEnv({
        E2ECTL_SMOKE_DNS_CREATE_DOMAIN: 'disposable.example.net',
        E2ECTL_SMOKE_DNS_DOMAIN: 'release.example.com',
        E2ECTL_SMOKE_NODE_IMAGE: 'ubuntu-24.04',
        E2ECTL_SMOKE_NODE_PLAN: 'C3.8GB',
        E2ECTL_SMOKE_UPGRADE_IMAGE: 'ubuntu-24.04',
        E2ECTL_SMOKE_UPGRADE_PLAN: 'C3.8GB',
        E2E_API_KEY: 'smoke-api-key',
        E2E_AUTH_TOKEN: 'smoke-auth-token',
        E2E_LOCATION: 'Delhi',
        E2E_PROJECT_ID: '46429'
      });
    }).toThrow(
      'Manual smoke upgrade target must differ from the create target in at least one of plan or image.'
    );
  });

  it('rejects matching dns record and dns create domains', () => {
    expect(() => {
      readSmokeEnv({
        E2ECTL_SMOKE_DNS_CREATE_DOMAIN: 'release.example.com',
        E2ECTL_SMOKE_DNS_DOMAIN: 'release.example.com',
        E2ECTL_SMOKE_NODE_IMAGE: 'ubuntu-24.04',
        E2ECTL_SMOKE_NODE_PLAN: 'C3.8GB',
        E2ECTL_SMOKE_UPGRADE_IMAGE: 'ubuntu-24.04-v2',
        E2ECTL_SMOKE_UPGRADE_PLAN: 'C3.16GB',
        E2E_API_KEY: 'smoke-api-key',
        E2E_AUTH_TOKEN: 'smoke-auth-token',
        E2E_LOCATION: 'Delhi',
        E2E_PROJECT_ID: '46429'
      });
    }).toThrow(
      'E2ECTL_SMOKE_DNS_CREATE_DOMAIN must differ from E2ECTL_SMOKE_DNS_DOMAIN.'
    );
  });
});
