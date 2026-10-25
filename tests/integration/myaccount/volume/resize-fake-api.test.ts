import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../../helpers/http-server.js';
import { runBuiltCli } from '../../../helpers/process.js';
import { createTempHome } from '../../../helpers/temp-home.js';

const API = '/myaccount/api/v1';

function ok(data: unknown, message = 'OK') {
  return { body: { code: 200, data, errors: {}, message } };
}

describe('volume resize against a fake MyAccount API', () => {
  it('sends the new size with the current name and the attached node', async () => {
    const server = await startTestHttpServer({
      [`GET ${API}/block_storage/5/`]: () =>
        ok({
          block_id: 5,
          name: 'data',
          size: 100,
          size_string: '100 GB',
          status: 'Attached',
          vm_detail: { vm_id: 9 }
        }),
      [`GET ${API}/block_storage/plans/`]: () =>
        ok([
          {
            available_inventory_status: true,
            bs_size: 0.1,
            iops: 1500,
            name: '100 GB'
          },
          {
            available_inventory_status: true,
            bs_size: 0.2,
            iops: 3000,
            name: '200 GB'
          }
        ]),
      [`PUT ${API}/block_storage/5/vm/upgrade/`]: () =>
        ok({ image_id: 5, vm_id: 9 }, 'Block Storage is upgraded.')
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'myaccount',
          'volume',
          'resize',
          '5',
          '--size',
          '200',
          '--force'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}${API}`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        previous_size_gb: 100,
        size_gb: 200
      });
      const put = server.requests.find((request) => request.method === 'PUT');
      expect(JSON.parse(put?.body ?? '{}')).toEqual({
        block_storage_size: 200,
        name: 'data',
        vm_id: 9
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
