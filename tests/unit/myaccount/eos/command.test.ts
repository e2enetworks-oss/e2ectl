import { runCli } from '../../../../src/app/index.js';
import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type { EosBucketApiItem } from '../../../../src/myaccount/eos/types.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const KEY = {
  access_key: 'AKEXAMPLE',
  disabled: false,
  id: 77,
  secret_key: 'must-never-print-from-a-list',
  tag: 'ci'
};

function eosMocks() {
  return {
    createBucket: vi.fn(() =>
      Promise.resolve({
        created_at: '2026-10-25',
        name: 'e2ectl-test',
        status: 'NEW',
        used_MB: 0
      })
    ),
    createKey: vi.fn(() =>
      Promise.resolve({
        ...KEY,
        minio_host_url: 'objectstore.example.com',
        secret_key: 'SECRET1'
      })
    ),
    deleteBucket: vi.fn(() =>
      Promise.resolve({ message: 'Bucket deletion is in progress.' })
    ),
    deleteKey: vi.fn(() => Promise.resolve({ message: 'OK' })),
    grantAccess: vi.fn(() =>
      Promise.resolve([{ id: 5, role: { name: 'Bucket Writer' }, user: KEY }])
    ),
    listAccess: vi.fn(() =>
      Promise.resolve([{ id: 5, role: { name: 'Odd Role' }, user: KEY }])
    ),
    listBuckets: vi.fn((): Promise<EosBucketApiItem[]> => Promise.resolve([])),
    listKeys: vi.fn(() => Promise.resolve([KEY])),
    revokeAccess: vi.fn(() => Promise.resolve({ message: 'OK' }))
  };
}

async function run(
  args: string[],
  mocks = eosMocks(),
  confirmAnswer?: boolean
): Promise<string> {
  const store = new ConfigStore({ configPath: createTestConfigPath('eos') });
  await store.upsertProfile('work', {
    api_key: 'k',
    auth_token: 't',
    myaccount: { location: 'Chennai', project_id: '1' }
  });
  const stdout = new MemoryWriter();
  await createProgram(
    createTestRuntime({
      confirm: () => Promise.resolve(confirmAnswer ?? false),
      createEosClient: () => mocks,
      isInteractive: confirmAnswer !== undefined,
      stdout,
      store
    })
  ).parseAsync(['node', 'e2ectl', ...args]);
  return stdout.buffer;
}

describe('eos buckets', () => {
  it('creates a bucket and suggests granting a key', async () => {
    const mocks = eosMocks();
    const output = await run(
      ['myaccount', 'eos', 'bucket', 'create', 'e2ectl-test'],
      mocks
    );

    expect(mocks.createBucket).toHaveBeenCalledWith('e2ectl-test');
    expect(output).toContain('eos access grant e2ectl-test');
  });

  it('shows buckets as a table in text mode', async () => {
    const mocks = eosMocks();
    mocks.listBuckets.mockResolvedValueOnce([
      { created_at: '2026-10-25', name: 'logs', status: 'NEW', used_MB: 3 }
    ]);

    const output = await run(['myaccount', 'eos', 'bucket', 'list'], mocks);

    expect(output).toContain('logs');
    expect(output).toContain('NEW');
  });

  it.each(['..', '.', 'ab', 'Logs', 'a/b'])(
    'refuses the bucket name %s before calling E2E',
    async (name) => {
      const mocks = eosMocks();

      await expect(
        run(['myaccount', 'eos', 'bucket', 'delete', name, '--force'], mocks)
      ).rejects.toMatchObject({ code: 'INVALID_EOS_BUCKET_NAME' });
      expect(mocks.deleteBucket).not.toHaveBeenCalled();
    }
  );

  it('says so when there are no buckets', async () => {
    expect(await run(['myaccount', 'eos', 'bucket', 'list'])).toBe(
      'No buckets found.\n'
    );
  });

  it('asks before deleting a bucket and its objects', async () => {
    const mocks = eosMocks();

    expect(
      await run(['myaccount', 'eos', 'bucket', 'delete', 'logs'], mocks, false)
    ).toBe('Deletion cancelled.\n');
    expect(mocks.deleteBucket).not.toHaveBeenCalled();
    await expect(
      run(['myaccount', 'eos', 'bucket', 'delete', 'logs'], mocks)
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED'
    });
    expect(
      await run(
        ['myaccount', 'eos', 'bucket', 'delete', 'logs', '--force'],
        mocks
      )
    ).toContain('in the background');
  });
});

describe('eos keys', () => {
  it('shows the secret key once, on create, with the endpoint', async () => {
    const output = await run([
      'myaccount',
      'eos',
      'key',
      'create',
      '--name',
      'ci2026'
    ]);

    expect(output).toContain('Secret key: SECRET1');
    expect(output).toContain('Endpoint:   objectstore.example.com');
    expect(output).toContain('Save the secret key now');
  });

  it('never prints secrets in the key list, text or JSON', async () => {
    const text = await run(['myaccount', 'eos', 'key', 'list']);
    const json = await run(['--json', 'myaccount', 'eos', 'key', 'list']);

    expect(text).not.toContain('must-never-print');
    expect(json).not.toContain('must-never-print');
    expect(JSON.parse(json)).toEqual({
      action: 'key-list',
      items: [{ access_key: 'AKEXAMPLE', disabled: false, id: 77, name: 'ci' }]
    });
  });

  it.each(['ci-key', 'ab', 'a b c'])(
    'refuses the key name %s before calling E2E',
    async (name) => {
      const mocks = eosMocks();

      await expect(
        run(['myaccount', 'eos', 'key', 'create', '--name', name], mocks)
      ).rejects.toMatchObject({ code: 'INVALID_EOS_KEY_NAME' });
      expect(mocks.createKey).not.toHaveBeenCalled();
    }
  );

  it('fails, naming the key, when E2E sends no secret', async () => {
    const mocks = eosMocks();
    mocks.createKey.mockResolvedValueOnce({
      ...KEY,
      minio_host_url: 'objectstore.example.com',
      secret_key: ''
    });

    await expect(
      run(['myaccount', 'eos', 'key', 'create', '--name', 'ci2026'], mocks)
    ).rejects.toMatchObject({
      code: 'EOS_KEY_SECRET_MISSING',
      suggestion: expect.stringContaining('eos key delete AKEXAMPLE') as string
    });
  });

  it('asks before deleting a key, and refuses an unknown one', async () => {
    const mocks = eosMocks();

    expect(
      await run(
        ['myaccount', 'eos', 'key', 'delete', 'AKEXAMPLE'],
        mocks,
        false
      )
    ).toBe('Deletion cancelled.\n');
    await expect(
      run(['myaccount', 'eos', 'key', 'delete', 'NOPE', '--force'], mocks)
    ).rejects.toMatchObject({ code: 'EOS_KEY_NOT_FOUND' });
    expect(mocks.deleteKey).not.toHaveBeenCalled();
  });

  it('deletes a key by access key with --force', async () => {
    const mocks = eosMocks();
    await run(
      ['myaccount', 'eos', 'key', 'delete', 'AKEXAMPLE', '--force'],
      mocks
    );

    expect(mocks.deleteKey).toHaveBeenCalledWith('AKEXAMPLE');
  });
});

describe('eos bucket access', () => {
  it('grants by looking the key up and sending its id and the role name', async () => {
    const mocks = eosMocks();
    const output = JSON.parse(
      await run(
        [
          '--json',
          'myaccount',
          'eos',
          'access',
          'grant',
          'logs',
          '--access-key',
          'AKEXAMPLE',
          '--role',
          'writer'
        ],
        mocks
      )
    ) as unknown;

    expect(mocks.grantAccess).toHaveBeenCalledWith('logs', {
      role_name: 'Bucket Writer',
      users: [{ id: 77 }]
    });
    expect(output).toEqual({
      action: 'access-grant',
      bucket: 'logs',
      items: [
        { access_key: 'AKEXAMPLE', id: 5, key_name: 'ci', role: 'writer' }
      ]
    });
    expect(JSON.stringify(output)).not.toContain('must-never-print');
  });

  it('shows access as a table in text mode, without secrets', async () => {
    const output = await run(['myaccount', 'eos', 'access', 'list', 'logs']);

    expect(output).toContain('AKEXAMPLE');
    expect(output).toContain('Odd Role');
    expect(output).not.toContain('must-never-print');
  });

  it('keeps E2E role names it does not know', async () => {
    expect(
      JSON.parse(
        await run(['--json', 'myaccount', 'eos', 'access', 'list', 'logs'])
      )
    ).toMatchObject({ items: [{ role: 'Odd Role' }] });
  });

  it.each([
    [
      ['grant', 'logs', '--access-key', 'NOPE', '--role', 'writer'],
      'EOS_KEY_NOT_FOUND'
    ],
    [['revoke', 'logs', '--access-key', 'NOPE'], 'EOS_ACCESS_NOT_FOUND']
  ])('refuses %o with %s', async (args, code) => {
    await expect(
      run(['myaccount', 'eos', 'access', ...args])
    ).rejects.toMatchObject({ code });
  });

  it.each([['owner'], ['constructor']])(
    'refuses --role %s as a usage error',
    async (role) => {
      const stderr = new MemoryWriter();
      const store = new ConfigStore({
        configPath: createTestConfigPath('eos-role')
      });
      const exitCode = await runCli(
        [
          'node',
          'e2ectl',
          'myaccount',
          'eos',
          'access',
          'grant',
          'logs',
          '--access-key',
          'AKEXAMPLE',
          '--role',
          role
        ],
        createTestRuntime({ createEosClient: () => eosMocks(), store }),
        stderr
      );

      expect(exitCode).toBe(2);
      expect(stderr.buffer).toContain(
        'Allowed choices are admin, writer, reader'
      );
    }
  );

  it('revokes by access key, looking up its access entry', async () => {
    const mocks = eosMocks();
    const output = await run(
      [
        'myaccount',
        'eos',
        'access',
        'revoke',
        'logs',
        '--access-key',
        'AKEXAMPLE'
      ],
      mocks
    );

    expect(mocks.revokeAccess).toHaveBeenCalledWith('logs', 5);
    expect(output).toContain(
      'Access key AKEXAMPLE can no longer use bucket logs.'
    );
  });
});
