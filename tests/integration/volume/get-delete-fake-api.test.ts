import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume get/delete against a fake MyAccount API', () => {
  it('gets one volume and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/25550/': () => ({
        body: {
          code: 200,
          data: {
            block_id: 25550,
            is_block_storage_exporting_to_eos: false,
            name: 'data-01',
            size: 238419,
            size_string: '250 GB',
            snapshot_exist: false,
            status: 'Available',
            vm_detail: {}
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'volume', 'get', '25550'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'get',
          volume: {
            attached: false,
            attachment: null,
            exporting_to_eos: false,
            id: 25550,
            name: 'data-01',
            size_gb: 250,
            size_label: '250 GB',
            snapshot_exists: false,
            status: 'Available'
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes one volume with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/block_storage/25550/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Block Storage Deleted'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'volume', 'delete', '25550', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'delete',
          cancelled: false,
          message: 'Block Storage Deleted',
          volume_id: 25550
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
