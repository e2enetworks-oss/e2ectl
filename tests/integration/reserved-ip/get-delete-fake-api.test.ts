import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('reserved-ip get/delete against a fake MyAccount API', () => {
  it('gets one reserved IP by filtering the list and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: [
            {
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [],
              ip_address: '164.52.198.54',
              project_name: 'default-project',
              reserve_id: 12662,
              reserved_type: 'AddonIP',
              status: 'Assigned',
              vm_id: 100157,
              vm_name: 'node-a'
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'reserved-ip', 'get', '164.52.198.54'],
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
          action: 'get',
          reserved_ip: {
            appliance_type: 'NODE',
            bought_at: '04-11-2024 10:37',
            floating_ip_attached_nodes: [],
            ip_address: '164.52.198.54',
            project_name: 'default-project',
            reserve_id: 12662,
            reserved_type: 'AddonIP',
            status: 'Assigned',
            vm_id: 100157,
            vm_name: 'node-a'
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects invalid reserved IP addresses before any network request', async () => {
    const result = await runBuiltCli(['reserved-ip', 'get', 'bad-ip']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Reserved IP address must be a valid IPv4 address.\n\nNext step: Pass a valid IPv4 address like 164.52.198.54 as the first argument.\n'
    );
  });

  it('returns a clear not-found error when the list has no exact ip_address match', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: [
            {
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [],
              ip_address: '164.52.198.55',
              project_name: 'default-project',
              reserve_id: 12663,
              reserved_type: 'AddonIP',
              status: 'Reserved',
              vm_id: null,
              vm_name: '--'
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['reserved-ip', 'get', '164.52.198.54'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Reserved IP 164.52.198.54 was not found.\n\nNext step: Run e2ectl reserved-ip list to inspect available reserved IPs, then retry with an exact ip_address.\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes one reserved IP with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/reserve_ips/164.52.198.54/actions/': () => ({
        body: {
          code: 200,
          data: {
            message: 'IP Released 164.52.198.54'
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'reserved-ip', 'delete', '164.52.198.54', '--force'],
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
          ip_address: '164.52.198.54',
          message: 'IP Released 164.52.198.54'
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails in non-interactive mode when delete omits --force', async () => {
    const result = await runBuiltCli([
      'reserved-ip',
      'delete',
      '164.52.198.54'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Deleting a reserved IP requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
    );
  });
});
