import { createProgram } from '../../../src/cli.js';
import type { MyAccountClient } from '../../../src/client/api.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { CliRuntime, OutputWriter } from '../../../src/runtime.js';

class MemoryWriter implements OutputWriter {
  buffer = '';

  write(chunk: string): void {
    this.buffer += chunk;
  }
}

function createNodeClientStub() {
  const listNodes = vi.fn(() =>
    Promise.resolve({
      code: 200,
      data: [
        {
          id: 101,
          name: 'node-a',
          status: 'Running',
          public_ip_address: '1.1.1.1',
          private_ip_address: '10.0.0.1',
          plan: 'C3.8GB',
          is_locked: false
        }
      ],
      errors: {},
      message: 'Success',
      total_count: 1,
      total_page_number: 1
    })
  );
  const getNode = vi.fn(() =>
    Promise.resolve({
      code: 200,
      data: {
        id: 101,
        name: 'node-a',
        status: 'Running',
        public_ip_address: '1.1.1.1',
        private_ip_address: '10.0.0.1',
        plan: 'C3.8GB',
        location: 'Delhi',
        created_at: '2026-03-11T10:00:00Z',
        disk: '100 GB',
        memory: '8 GB',
        vcpus: '4'
      },
      errors: {},
      message: 'Success'
    })
  );

  const stub: MyAccountClient = {
    delete: vi.fn(),
    get: vi.fn(),
    getNode,
    listNodes,
    post: vi.fn(),
    request: vi.fn(),
    validateCredentials: vi.fn()
  };

  return {
    getNode,
    listNodes,
    stub
  };
}

describe('node commands', () => {
  function createRuntimeFixture(): {
    runtime: CliRuntime;
    stdout: MemoryWriter;
  } {
    const configPath = `${process.cwd()}/.tmp/node-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const clientStub = createNodeClientStub();

    const runtime: CliRuntime = {
      createApiClient: () => clientStub.stub,
      credentialValidator: {
        validate: vi.fn()
      },
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      runtime,
      stdout
    };
  }

  it('lists nodes in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      project_id: '12345',
      location: 'Delhi'
    });
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('"action": "list"');
    expect(stdout.buffer).toContain('"name": "node-a"');
  });

  it('gets a node in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      project_id: '12345',
      location: 'Delhi'
    });
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      'node',
      'get',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 101');
    expect(stdout.buffer).toContain('Name: node-a');
    expect(stdout.buffer).toContain('Status: Running');
  });
});
