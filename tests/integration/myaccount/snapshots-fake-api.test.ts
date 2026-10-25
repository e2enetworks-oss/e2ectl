import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

const API = '/myaccount/api/v1';

function ok(data: unknown) {
  return { body: { code: 200, data, errors: {}, message: 'OK' } };
}

const SNAPSHOT = {
  date: '25-10-2026 10:00',
  is_locked: false,
  name: 'before-upgrade',
  snapshot_id: '7',
  snapshot_size: '1.5 GB',
  snapshot_uuid: '901',
  status: 'Ready'
};

describe('node and volume snapshots against a fake MyAccount API', () => {
  it('sends each snapshot call to its path with its body', async () => {
    const server = await startTestHttpServer({
      [`GET ${API}/nodes/101/snapshots/`]: () => ok([SNAPSHOT]),
      [`POST ${API}/nodes/101/snapshots/`]: () => ok({}),
      [`POST ${API}/nodes/101/snapshot/901`]: () => ok({}),
      [`DELETE ${API}/nodes/101/snapshot/901`]: () => ok({}),
      [`GET ${API}/block_storage/5/`]: () =>
        ok({
          block_id: 5,
          name: 'data',
          size: 250,
          status: 'Attached',
          vm_detail: { vm_id: 9 }
        }),
      [`GET ${API}/block_storage/5/snapshot/`]: () => ok([SNAPSHOT]),
      [`POST ${API}/block_storage/5/snapshot/`]: () => ok({}),
      [`PUT ${API}/block_storage/5/restore/`]: () => ok({}),
      [`DELETE ${API}/block_storage/5/snapshot/7`]: () => ok({})
    });
    const tempHome = await createTempHome();
    const env = {
      HOME: tempHome.path,
      [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}${API}`
    };
    const run = (args: string[]) =>
      runBuiltCli(['--json', 'myaccount', ...args], { env });

    try {
      await seedDefaultProfile(tempHome);

      const nodeList = await run(['node', 'snapshot', 'list', '101']);
      expect(JSON.parse(nodeList.stdout)).toMatchObject({
        items: [{ id: '901' }]
      });
      expect(
        (await run(['node', 'snapshot', 'create', '101', '--name', 'snap']))
          .exitCode
      ).toBe(0);
      expect(
        (
          await run([
            'node',
            'snapshot',
            'save-image',
            '101',
            '901',
            '--name',
            'img'
          ])
        ).exitCode
      ).toBe(0);
      expect(
        (await run(['node', 'snapshot', 'delete', '101', '901', '--force']))
          .exitCode
      ).toBe(0);

      const volumeList = await run(['volume', 'snapshot', 'list', '5']);
      expect(JSON.parse(volumeList.stdout)).toMatchObject({
        items: [{ id: '7' }]
      });
      expect(
        (await run(['volume', 'snapshot', 'create', '5', '--name', 'snap']))
          .exitCode
      ).toBe(0);
      expect(
        (
          await run([
            'volume',
            'snapshot',
            'save-volume',
            '5',
            '7',
            '--name',
            'copy'
          ])
        ).exitCode
      ).toBe(0);
      expect(
        (await run(['volume', 'snapshot', 'delete', '5', '7', '--force']))
          .exitCode
      ).toBe(0);

      const bodyOf = (method: string, path: string): unknown =>
        JSON.parse(
          server.requests.find(
            (request) => request.method === method && request.pathname === path
          )?.body ?? '{}'
        );
      expect(bodyOf('POST', `${API}/nodes/101/snapshots/`)).toEqual({
        name: 'snap'
      });
      expect(bodyOf('POST', `${API}/nodes/101/snapshot/901`)).toEqual({
        disk_id: 0,
        name: 'img'
      });
      expect(bodyOf('PUT', `${API}/block_storage/5/restore/`)).toEqual({
        name: 'copy',
        snapshot_id: 7,
        vm_id: 9
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
