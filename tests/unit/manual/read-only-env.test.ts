import { readReadOnlyEnv } from '../../manual/helpers/read-only-env.js';

describe('read-only env parsing', () => {
  it('fails fast with one aggregated error when required base env vars are missing', () => {
    expect(() => {
      readReadOnlyEnv({});
    }).toThrow(
      'Manual read-only checks requires E2E_API_KEY, E2E_AUTH_TOKEN, E2E_PROJECT_ID, E2E_LOCATION. Missing: E2E_API_KEY, E2E_AUTH_TOKEN, E2E_PROJECT_ID, E2E_LOCATION.'
    );
  });

  it('returns trimmed CLI env and optional fixtures', () => {
    const result = readReadOnlyEnv({
      E2ECTL_MANUAL_DNS_DOMAIN: ' example.com ',
      E2ECTL_MANUAL_NODE_ID: ' 101 ',
      E2ECTL_MANUAL_RESERVED_IP: ' 203.0.113.20 ',
      E2ECTL_MANUAL_SECURITY_GROUP_ID: ' 57358 ',
      E2ECTL_MANUAL_SSH_KEY_ID: ' 1001 ',
      E2ECTL_MANUAL_VOLUME_ID: ' 25550 ',
      E2ECTL_MANUAL_VPC_ID: ' 27835 ',
      E2ECTL_MYACCOUNT_BASE_URL: ' https://api.example.test ',
      E2E_API_KEY: ' demo-api-key ',
      E2E_AUTH_TOKEN: ' demo-auth-token ',
      E2E_LOCATION: ' Delhi ',
      E2E_PROJECT_ID: ' 46429 '
    });

    expect(result.cliEnv).toEqual({
      E2ECTL_MYACCOUNT_BASE_URL: 'https://api.example.test',
      E2E_API_KEY: 'demo-api-key',
      E2E_AUTH_TOKEN: 'demo-auth-token',
      E2E_LOCATION: 'Delhi',
      E2E_PROJECT_ID: '46429'
    });
    expect(result.fixtures).toEqual({
      dnsDomain: 'example.com',
      nodeId: '101',
      reservedIp: '203.0.113.20',
      securityGroupId: '57358',
      sshKeyId: '1001',
      volumeId: '25550',
      vpcId: '27835'
    });
  });
});
