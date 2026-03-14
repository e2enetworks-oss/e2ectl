import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type {
  ProfileConfig,
  ResolvedCredentials
} from '../../../src/config/index.js';
import {
  ApiCredentialValidator,
  type CredentialValidationResult
} from '../../../src/myaccount/credential-validator.js';
import { MyAccountApiTransport } from '../../../src/myaccount/index.js';
import { NodeApiClient } from '../../../src/node/index.js';
import { SshKeyApiClient } from '../../../src/ssh-key/index.js';
import { VolumeApiClient } from '../../../src/volume/index.js';
import { VpcApiClient } from '../../../src/vpc/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

class StubCredentialValidator extends ApiCredentialValidator {
  readonly calls: ProfileConfig[] = [];
  private readonly result: CredentialValidationResult;

  constructor(result: CredentialValidationResult = { valid: true }) {
    super();
    this.result = result;
  }

  override validate(
    profile: ProfileConfig
  ): Promise<CredentialValidationResult> {
    this.calls.push(profile);
    return Promise.resolve(this.result);
  }
}

function toJsonOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

describe('config commands', () => {
  function createRuntimeFixture(): {
    confirm: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    validator: StubCredentialValidator;
    store: ConfigStore;
  } {
    const configPath = createTestConfigPath('config-test');
    const stdout = new MemoryWriter();
    const validator = new StubCredentialValidator();
    const store = new ConfigStore({ configPath });
    const confirm = vi.fn(() => Promise.resolve(true));
    const prompt = vi.fn(() => Promise.resolve(''));

    return {
      confirm,
      prompt,
      runtime: {
        confirm,
        createNodeClient: (credentials: ResolvedCredentials) =>
          new NodeApiClient(new MyAccountApiTransport(credentials)),
        createSshKeyClient: (credentials: ResolvedCredentials) =>
          new SshKeyApiClient(new MyAccountApiTransport(credentials)),
        createVolumeClient: (credentials: ResolvedCredentials) =>
          new VolumeApiClient(new MyAccountApiTransport(credentials)),
        createVpcClient: (credentials: ResolvedCredentials) =>
          new VpcApiClient(new MyAccountApiTransport(credentials)),
        credentialValidator: validator,
        isInteractive: true,
        prompt,
        stderr: new MemoryWriter(),
        stdout,
        store
      },
      stdout,
      validator,
      store
    };
  }

  async function createImportFile(payload: unknown): Promise<string> {
    const filePath = path.join(
      process.cwd(),
      '.tmp',
      `import-${Math.random().toString(36).slice(2)}.json`
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
    return filePath;
  }

  it('adds a profile with optional default context and prints masked json output', async () => {
    const { runtime, stdout, validator } = createRuntimeFixture();
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'add',
      '--alias',
      'prod',
      '--api-key',
      'api-123456',
      '--auth-token',
      'auth-654321',
      '--default-project-id',
      '12345',
      '--default-location',
      'Delhi'
    ]);

    expect(validator.calls).toEqual([
      {
        api_key: 'api-123456',
        auth_token: 'auth-654321',
        default_project_id: '12345',
        default_location: 'Delhi'
      }
    ]);
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'saved',
        default: 'prod',
        profiles: [
          {
            alias: 'prod',
            api_key: '****3456',
            auth_token: '****4321',
            default_location: 'Delhi',
            default_project_id: '12345',
            isDefault: true
          }
        ]
      })
    );
  });

  it('lists profiles with masked table output and default context columns', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      default_project_id: '12345',
      default_location: 'Delhi'
    });

    await program.parseAsync(['node', CLI_COMMAND_NAME, 'config', 'list']);

    expect(stdout.buffer).toContain('prod');
    expect(stdout.buffer).toContain('****3456');
    expect(stdout.buffer).toContain('****4321');
    expect(stdout.buffer).toContain('12345');
    expect(stdout.buffer).toContain('Delhi');
  });

  it('lists profiles in deterministic json mode', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
    await store.upsertProfile('staging', {
      api_key: 'api-999999',
      auth_token: 'auth-888888'
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'list'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'list',
        default: 'prod',
        profiles: [
          {
            alias: 'prod',
            api_key: '****3456',
            auth_token: '****4321',
            default_location: 'Delhi',
            default_project_id: '12345',
            isDefault: true
          },
          {
            alias: 'staging',
            api_key: '****9999',
            auth_token: '****8888',
            default_location: '',
            default_project_id: '',
            isDefault: false
          }
        ]
      })
    );
  });

  it('sets the default alias', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
    await store.upsertProfile('staging', {
      api_key: 'api-999999',
      auth_token: 'auth-888888',
      default_project_id: '67890',
      default_location: 'Chennai'
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'set-default',
      '--alias',
      'staging'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'set-default',
        default: 'staging',
        profiles: [
          {
            alias: 'prod',
            api_key: '****3456',
            auth_token: '****4321',
            default_location: 'Delhi',
            default_project_id: '12345',
            isDefault: false
          },
          {
            alias: 'staging',
            api_key: '****9999',
            auth_token: '****8888',
            default_location: 'Chennai',
            default_project_id: '67890',
            isDefault: true
          }
        ]
      })
    );
  });

  it('updates the default context for a saved alias', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321'
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'set-context',
      '--alias',
      'prod',
      '--default-project-id',
      '46429',
      '--default-location',
      'Delhi'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'set-context',
        default: 'prod',
        profiles: [
          {
            alias: 'prod',
            api_key: '****3456',
            auth_token: '****4321',
            default_location: 'Delhi',
            default_project_id: '46429',
            isDefault: true
          }
        ]
      })
    );
  });

  it('removes a saved profile', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      default_project_id: '12345',
      default_location: 'Delhi'
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'remove',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'removed',
        default: null,
        profiles: []
      })
    );
  });

  it('rejects unsupported default locations before validation', async () => {
    const { runtime, validator } = createRuntimeFixture();
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'config',
        'add',
        '--alias',
        'prod',
        '--api-key',
        'api-123456',
        '--auth-token',
        'auth-654321',
        '--default-location',
        'Noida'
      ])
    ).rejects.toThrow(/Unsupported default location/i);
    expect(validator.calls).toHaveLength(0);
  });

  it('rejects blank aliases before validation and does not persist config', async () => {
    const { runtime, store, validator } = createRuntimeFixture();
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'config',
        'add',
        '--alias',
        '   ',
        '--api-key',
        'api-123456',
        '--auth-token',
        'auth-654321'
      ])
    ).rejects.toThrow(/Profile alias cannot be empty/i);

    expect(validator.calls).toHaveLength(0);
    await expect(store.read()).resolves.toEqual({
      profiles: {}
    });
  });

  it('imports aliases, prompts for shared default context, and offers a default alias', async () => {
    const { confirm, prompt, runtime, stdout, store, validator } =
      createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });

    confirm.mockResolvedValueOnce(true);
    prompt
      .mockResolvedValueOnce('46429')
      .mockResolvedValueOnce('Delhi')
      .mockResolvedValueOnce('prod');

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'config',
      'import',
      '--file',
      filePath
    ]);

    expect(validator.calls).toEqual([
      {
        api_key: 'api-prod',
        auth_token: 'auth-prod'
      },
      {
        api_key: 'api-staging',
        auth_token: 'auth-staging'
      }
    ]);

    const config = await store.read();
    expect(config.default).toBe('prod');
    expect(config.profiles.prod).toMatchObject({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '46429',
      default_location: 'Delhi'
    });
    expect(config.profiles.staging).toMatchObject({
      api_key: 'api-staging',
      auth_token: 'auth-staging',
      default_project_id: '46429',
      default_location: 'Delhi'
    });
    expect(stdout.buffer).toContain('Imported 2 profiles');
    expect(stdout.buffer).toContain('Saved aliases: prod, staging.');
    expect(stdout.buffer).toContain('Saved default project ID "46429"');
    expect(stdout.buffer).toContain('Saved default location "Delhi"');
    expect(stdout.buffer).toContain('Set "prod" as the default profile.');
  });

  it('supports a fully non-interactive import with explicit defaults', async () => {
    const { confirm, prompt, runtime, stdout, store, validator } =
      createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'config',
      'import',
      '--file',
      filePath,
      '--default-project-id',
      '46429',
      '--default-location',
      'Delhi',
      '--default',
      'prod',
      '--no-input'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    expect(validator.calls).toEqual([
      {
        api_key: 'api-prod',
        auth_token: 'auth-prod'
      }
    ]);

    const config = await store.read();
    expect(config.default).toBe('prod');
    expect(config.profiles.prod).toMatchObject({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '46429',
      default_location: 'Delhi'
    });
    expect(stdout.buffer).toBe(
      toJsonOutput({
        action: 'imported',
        default: 'prod',
        imported_aliases: ['prod'],
        imported_count: 1,
        profiles: [
          {
            alias: 'prod',
            api_key: '****prod',
            auth_token: '****prod',
            default_location: 'Delhi',
            default_project_id: '46429',
            isDefault: true
          }
        ],
        saved_default_location: 'Delhi',
        saved_default_project_id: '46429'
      })
    );
  });

  it('allows non-interactive imports without default project or location', async () => {
    const { confirm, prompt, runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram({
      ...runtime,
      isInteractive: false
    });
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'config',
      'import',
      '--file',
      filePath,
      '--no-input'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();

    const config = await store.read();
    expect(config.default).toBeUndefined();
    expect(config.profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod'
    });
    expect(stdout.buffer).toContain('Imported 1 profile');
    expect(stdout.buffer).toContain('No default profile was set.');
  });

  it('leaves the saved config unchanged when the requested default alias is blank', async () => {
    const { runtime, store } = createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await store.upsertProfile('existing', {
      api_key: 'api-existing',
      auth_token: 'auth-existing',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
    const initialConfig = await store.read();

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'config',
        'import',
        '--file',
        filePath,
        '--default',
        '   ',
        '--no-input'
      ])
    ).rejects.toThrow(/Default alias cannot be empty/i);

    await expect(store.read()).resolves.toEqual(initialConfig);
  });

  it('leaves the saved config unchanged when import validation fails', async () => {
    const { runtime, store, validator } = createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });

    await store.upsertProfile('existing', {
      api_key: 'api-existing',
      auth_token: 'auth-existing',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
    const initialConfig = await store.read();

    vi.spyOn(validator, 'validate').mockImplementation((profile) => {
      validator.calls.push(profile);
      if (profile.api_key === 'api-staging') {
        throw new Error('Credentials rejected');
      }

      return Promise.resolve({
        valid: true
      });
    });

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'config',
        'import',
        '--file',
        filePath,
        '--no-input'
      ])
    ).rejects.toThrow(/Credentials rejected/i);

    expect(validator.calls).toEqual([
      {
        api_key: 'api-prod',
        auth_token: 'auth-prod'
      },
      {
        api_key: 'api-staging',
        auth_token: 'auth-staging'
      }
    ]);
    await expect(store.read()).resolves.toEqual(initialConfig);
  });
});
