import { createProgram } from '../../../../src/app/program.js';
import type { CliRuntime } from '../../../../src/app/runtime.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type { SslClient } from '../../../../src/myaccount/ssl/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

async function createRuntimeWithSslClient(
  sslClient: SslClient
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

  const runtime: CliRuntime = createTestRuntime({
    confirm: vi.fn(),
    createSslClient: vi
      .fn()
      .mockReturnValue(sslClient) as unknown as CliRuntime['createSslClient'],
    credentialValidator: { validate: vi.fn() },
    isInteractive: false,
    prompt: vi.fn(),
    stderr,
    stdout,
    store
  });

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
      'myaccount',
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
      'myaccount',
      'ssl',
      'list',
      '--alias',
      'default'
    ]);

    expect(stdout.buffer).toContain('No SSL certificates found.');
  });
});
