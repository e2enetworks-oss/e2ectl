import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../../helpers/http-server.js';
import { runBuiltCli } from '../../../helpers/process.js';
import { createTempHome } from '../../../helpers/temp-home.js';

const API = '/myaccount/api/v1';
const KEY = {
  access_key: 'AKEXAMPLE',
  id: 77,
  secret_key: 'listed-secret',
  tag: 'ci'
};

function ok(data: unknown, message = 'OK') {
  return { body: { code: 200, data, errors: {}, message } };
}

describe('eos against a fake MyAccount API', () => {
  it('runs a bucket, key and access round trip on the right paths', async () => {
    const server = await startTestHttpServer({
      [`POST ${API}/storage/buckets/e2ectl-test/`]: () =>
        ok({ name: 'e2ectl-test', status: 'NEW' }),
      [`GET ${API}/storage/buckets/`]: () =>
        ok([{ name: 'e2ectl-test', status: 'NEW', used_MB: 0 }]),
      [`POST ${API}/storage/core/users/`]: () =>
        ok({
          ...KEY,
          minio_host_url: 'objectstore.example.com',
          secret_key: 'new-secret'
        }),
      [`GET ${API}/storage/core/list/users/`]: () => ok([KEY]),
      [`PUT ${API}/storage/bucket_perms/`]: () =>
        ok([{ id: 5, role: { name: 'Bucket Writer' }, user: KEY }]),
      [`GET ${API}/storage/bucket_perms/`]: () =>
        ok([{ id: 5, role: { name: 'Bucket Writer' }, user: KEY }]),
      [`DELETE ${API}/storage/bucket_perm/5/`]: () => ok({}),
      // The real reply: errors is text, not an object.
      [`DELETE ${API}/storage/core/users/`]: () => ({
        body: {
          code: 200,
          data: {},
          errors: '',
          message: 'The delete operation is successful'
        }
      }),
      [`DELETE ${API}/storage/buckets/e2ectl-test/`]: () =>
        ok({}, 'Bucket deletion is in progress.')
    });
    const tempHome = await createTempHome();
    const env = {
      HOME: tempHome.path,
      [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}${API}`
    };
    const run = async (args: string[]) => {
      const result = await runBuiltCli(
        ['--json', 'myaccount', 'eos', ...args],
        { env }
      );
      expect(result.exitCode).toBe(0);
      return result.stdout;
    };

    try {
      await seedDefaultProfile(tempHome);

      await run(['bucket', 'create', 'e2ectl-test']);
      expect(
        JSON.parse(await run(['key', 'create', '--name', 'ci2026']))
      ).toMatchObject({
        endpoint: 'objectstore.example.com',
        key: { access_key: 'AKEXAMPLE', secret_key: 'new-secret' }
      });
      expect(await run(['key', 'list'])).not.toContain('listed-secret');
      await run([
        'access',
        'grant',
        'e2ectl-test',
        '--access-key',
        'AKEXAMPLE',
        '--role',
        'writer'
      ]);
      expect(await run(['access', 'list', 'e2ectl-test'])).not.toContain(
        'listed-secret'
      );
      await run(['access', 'revoke', 'e2ectl-test', '5']);
      await run(['key', 'delete', 'AKEXAMPLE', '--force']);
      await run(['bucket', 'delete', 'e2ectl-test', '--force']);

      const grant = server.requests.find((request) => request.method === 'PUT');
      expect(grant?.query).toMatchObject({
        bucket_name: 'e2ectl-test',
        location: 'Delhi',
        project_id: '46429'
      });
      expect(JSON.parse(grant?.body ?? '{}')).toEqual({
        role_name: 'Bucket Writer',
        users: [{ id: 77 }]
      });
      const keyDelete = server.requests.find(
        (request) =>
          request.method === 'DELETE' &&
          request.pathname === `${API}/storage/core/users/`
      );
      expect(keyDelete?.query.access_key).toBe('AKEXAMPLE');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
