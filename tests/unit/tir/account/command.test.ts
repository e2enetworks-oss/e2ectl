import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type {
  TirAccountApiItem,
  TirAccountClient
} from '../../../../src/tir/account/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const ACCOUNTS: TirAccountApiItem[] = [
  {
    has_tir_access: true,
    id: 11,
    owner: { email: 'owner@example.com', name: 'Owner' },
    role: 'Owner'
  },
  { id: 22, role: 'Member' }
];

async function runTirAccountList(
  accounts: TirAccountApiItem[],
  extraArgs: string[] = []
): Promise<{ listAccounts: TirAccountClient['listAccounts']; output: string }> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('tir-account-command-test')
  });
  await store.upsertProfile('default', { api_key: 'key', auth_token: 'token' });
  const stdout = new MemoryWriter();
  const listAccounts = vi.fn(() => Promise.resolve(accounts));
  const client: TirAccountClient = { listAccounts };
  const program = createProgram(
    createTestRuntime({ createTirAccountClient: () => client, stdout, store })
  );

  await program.parseAsync([
    'node',
    'e2ectl',
    ...extraArgs,
    'tir',
    'account',
    'list'
  ]);

  return { listAccounts, output: stdout.buffer };
}

describe('tir account list', () => {
  it('lists accounts with role, TIR access and the next command', async () => {
    const { output } = await runTirAccountList(ACCOUNTS);

    expect(output).toContain('owner@example.com');
    expect(output).toContain('Owner');
    expect(output).toContain('Next: e2ectl tir project list --account-id <id>');
  });

  it('emits deterministic JSON with missing owner fields filled in', async () => {
    const { output } = await runTirAccountList(ACCOUNTS, ['--json']);

    expect(JSON.parse(output)).toEqual({
      action: 'list',
      items: [
        {
          email: 'owner@example.com',
          id: 11,
          name: 'Owner',
          role: 'Owner',
          tir_access: true
        },
        { email: '', id: 22, name: '', role: 'Member', tir_access: false }
      ]
    });
  });

  it('needs no TIR account, project or location to list accounts', async () => {
    const { listAccounts } = await runTirAccountList([]);

    expect(listAccounts).toHaveBeenCalledTimes(1);
  });

  it('says so when the key has no accounts', async () => {
    const { output } = await runTirAccountList([]);

    expect(output).toBe('No TIR accounts found for this key.\n');
  });
});
