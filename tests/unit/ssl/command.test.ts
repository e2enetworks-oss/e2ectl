import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { SslClient } from '../../../src/ssl/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

async function createRuntimeWithSslClient(
  sslClient: SslClient | undefined
): Promise<{ runtime: CliRuntime; stdout: MemoryWriter }> {
  const configPath = createTestConfigPath('ssl-command-test');
  const store = new ConfigStore({ configPath });
  await store.upsertProfile('default', {
    api_key: 'key',
    auth_token: 'token',
    default_location: 'Delhi',
    default_project_id: '1'
  });

  const stdout = new MemoryWriter();
  const stderr = new MemoryWriter();

  const runtime: CliRuntime = {
    confirm: vi.fn(),
    createImageClient: vi.fn() as unknown as CliRuntime['createImageClient'],
    createLoadBalancerClient:
      vi.fn() as unknown as CliRuntime['createLoadBalancerClient'],
    createNodeClient: vi.fn() as unknown as CliRuntime['createNodeClient'],
    createProjectClient:
      vi.fn() as unknown as CliRuntime['createProjectClient'],
    createReservedIpClient:
      vi.fn() as unknown as CliRuntime['createReservedIpClient'],
    createSecurityGroupClient:
      vi.fn() as unknown as CliRuntime['createSecurityGroupClient'],
    createSshKeyClient: vi.fn() as unknown as CliRuntime['createSshKeyClient'],
    ...(sslClient
      ? {
          createSslClient: vi
            .fn()
            .mockReturnValue(sslClient) as unknown as NonNullable<
            CliRuntime['createSslClient']
          >
        }
      : {}),
    createVolumeClient: vi.fn() as unknown as CliRuntime['createVolumeClient'],
    createVpcClient: vi.fn() as unknown as CliRuntime['createVpcClient'],
    credentialValidator: { validate: vi.fn() },
    isInteractive: false,
    prompt: vi.fn(),
    stderr,
    stdout,
    store
  };

  return { runtime, stdout };
}

describe('ssl commands', () => {
  it('lists SSL certificates', async () => {
    const sslClient: SslClient = {
      listCertificates: vi.fn(() =>
        Promise.resolve([
          {
            id: 1772,
            ssl_cert_name: 'my-cert',
            ssl_domain_name: 'example.com',
            ssl_certificate_type: 'Imported',
            ssl_certificate_state: 'NA',
            expiry_date: '30/Mar/2026 12:03 PM'
          }
        ])
      )
    };

    const { runtime, stdout } = await createRuntimeWithSslClient(sslClient);
    const program = createProgram(runtime);
    await program.parseAsync([
      'node',
      'e2ectl',
      'ssl',
      'list',
      '--alias',
      'default'
    ]);

    expect(stdout.buffer).toContain('1772');
    expect(stdout.buffer).toContain('my-cert');
    expect(stdout.buffer).toContain('example.com');
  });

  it('renders empty list message when no certificates exist', async () => {
    const sslClient: SslClient = {
      listCertificates: vi.fn(() => Promise.resolve([]))
    };

    const { runtime, stdout } = await createRuntimeWithSslClient(sslClient);
    const program = createProgram(runtime);
    await program.parseAsync([
      'node',
      'e2ectl',
      'ssl',
      'list',
      '--alias',
      'default'
    ]);

    expect(stdout.buffer).toContain('No SSL certificates found.');
  });

  it('throws CliError when createSslClient is not available in runtime', async () => {
    const { runtime } = await createRuntimeWithSslClient(undefined);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'ssl',
        'list',
        '--alias',
        'default'
      ])
    ).rejects.toThrow('SSL client is not available in this runtime.');
  });
});
