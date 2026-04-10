import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { formatCliCommand } from '../../../src/app/metadata.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node action validation through the built CLI', () => {
  it('rejects missing image names for save-image', async () => {
    const result = await runBuiltCli(['node', 'action', 'save-image', '101']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--name <name>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('rejects missing VPC ids for VPC attach', async () => {
    const result = await runBuiltCli([
      'node',
      'action',
      'vpc',
      'attach',
      '101'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--vpc-id <vpcId>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('rejects missing volume ids for volume attach', async () => {
    const result = await runBuiltCli([
      'node',
      'action',
      'volume',
      'attach',
      '101'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--volume-id <volumeId>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('rejects missing ssh key ids for ssh-key attach', async () => {
    const result = await runBuiltCli([
      'node',
      'action',
      'ssh-key',
      'attach',
      '101'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--ssh-key-id <sshKeyId>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('fails before the node action request when an ssh key id does not resolve', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ssh_keys/': () => ({
        body: {
          code: 200,
          data: [
            {
              label: 'admin',
              pk: 12,
              ssh_key: 'ssh-ed25519 AAAA admin@example.com',
              timestamp: '14-Mar-2026'
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['node', 'action', 'ssh-key', 'attach', '101', '--ssh-key-id', '99'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        `Error: Unknown SSH key ID: 99.\n\nNext step: Run ${formatCliCommand('ssh-key list')} to inspect saved SSH key ids, then retry with one or more listed ids.\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/ssh_keys/'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
