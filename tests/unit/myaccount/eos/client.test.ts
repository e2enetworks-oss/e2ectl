import { EosApiClient } from '../../../../src/myaccount/eos/client.js';
import { createStubTransport } from '../../../helpers/stub-transport.js';

describe('EosApiClient', () => {
  it.each([
    [
      'createBucket',
      (client: EosApiClient) => client.createBucket('logs'),
      { method: 'POST', options: { body: {} }, path: '/storage/buckets/logs/' }
    ],
    [
      'deleteBucket',
      (client: EosApiClient) => client.deleteBucket('logs'),
      { method: 'DELETE', options: undefined, path: '/storage/buckets/logs/' }
    ],
    [
      'listBuckets',
      (client: EosApiClient) => client.listBuckets(),
      { method: 'GET', options: undefined, path: '/storage/buckets/' }
    ],
    [
      'createKey',
      (client: EosApiClient) => client.createKey('ci2026'),
      {
        method: 'POST',
        options: { body: { tag: 'ci2026' } },
        path: '/storage/core/users/'
      }
    ],
    [
      'listKeys',
      (client: EosApiClient) => client.listKeys(),
      { method: 'GET', options: undefined, path: '/storage/core/list/users/' }
    ],
    [
      'listAccess',
      (client: EosApiClient) => client.listAccess('logs'),
      {
        method: 'GET',
        options: { query: { bucket_name: 'logs' } },
        path: '/storage/bucket_perms/'
      }
    ],
    [
      'grantAccess',
      (client: EosApiClient) =>
        client.grantAccess('logs', {
          role_name: 'Bucket Writer',
          users: [{ id: 7 }]
        }),
      {
        method: 'REQUEST',
        options: {
          body: { role_name: 'Bucket Writer', users: [{ id: 7 }] },
          method: 'PUT',
          path: '/storage/bucket_perms/',
          query: { bucket_name: 'logs' }
        }
      }
    ],
    [
      'revokeAccess',
      (client: EosApiClient) => client.revokeAccess('logs', 5),
      {
        method: 'DELETE',
        options: { query: { bucket_name: 'logs' } },
        path: '/storage/bucket_perm/5/'
      }
    ]
  ])('%s calls the right path', async (_name, call, expected) => {
    const { calls, transport } = createStubTransport();

    await call(new EosApiClient(transport));

    expect(calls).toEqual([expected]);
  });

  it('deletes a key by access key and reads its text-error reply', async () => {
    const { calls, transport } = createStubTransport();

    await new EosApiClient(transport).deleteKey('AKEXAMPLE');

    expect(calls[0]).toMatchObject({
      method: 'DELETE',
      options: { query: { access_key: 'AKEXAMPLE' } },
      path: '/storage/core/users/'
    });
    const options = calls[0]?.options as {
      parseResponse: (payload: unknown) => { message: string };
    };
    const { parseResponse } = options;
    expect(parseResponse({ errors: '', message: 'Deleted' })).toEqual({
      message: 'Deleted'
    });
    expect(parseResponse('')).toEqual({ message: '' });
  });
});
