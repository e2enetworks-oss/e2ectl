import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { SslClient } from '../../../src/ssl/index.js';
import { SslService } from '../../../src/ssl/service.js';
import { createTestConfigPath } from '../../helpers/runtime.js';

describe('SslService', () => {
  it('resolves credentials and lists certificates', async () => {
    const store = new ConfigStore({
      configPath: createTestConfigPath('ssl-service-test')
    });
    await store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_location: 'Delhi',
      default_project_id: '12345'
    });
    let receivedCredentials: ResolvedCredentials | undefined;
    const client: SslClient = {
      listCertificates: vi.fn(() =>
        Promise.resolve([
          {
            id: 123,
            ssl_cert_name: 'api-cert'
          }
        ])
      )
    };
    const service = new SslService({
      createSslClient(credentials) {
        receivedCredentials = credentials;
        return client;
      },
      store
    });

    const result = await service.listCertificates({ alias: 'prod' });

    expect(result).toEqual({
      action: 'list',
      items: [
        {
          id: 123,
          ssl_cert_name: 'api-cert'
        }
      ]
    });
    expect(receivedCredentials?.project_id).toBe('12345');
  });
});
