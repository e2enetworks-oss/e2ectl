import { access } from 'node:fs/promises';
import path from 'node:path';

import { runBuiltCli } from '../../../helpers/process.js';
import { createConfigBackedReadOnlyHome } from '../../helpers/read-only-profile.js';
import {
  readReadOnlyEnv,
  toConfigBackedReadOnlyCliEnv,
  type ReadOnlyEnv
} from '../../helpers/read-only-env.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;

const MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS = 60 * 1000;
const MANUAL_READ_ONLY_TEST_TIMEOUT_MS = 10 * 60 * 1000;

const itWithLbId = process.env.E2ECTL_MANUAL_LB_ID ? it : it.skip;

interface JsonCommandResult {
  action?: string;
}

interface LbListJson extends JsonCommandResult {
  items: unknown[];
}

interface LbPlansJson extends JsonCommandResult {
  items: unknown[];
}

interface SslListJson extends JsonCommandResult {
  items: unknown[];
}

interface LbGetJson extends JsonCommandResult {
  item: {
    id: number | string;
    lb_mode: string;
    status: string;
    public_ip: string;
  };
}

let readOnlyEnv: ReadOnlyEnv;

describeManual('manual read-only load-balancer built CLI checks', () => {
  beforeAll(async () => {
    readOnlyEnv = readReadOnlyEnv();

    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'resolves a saved default profile and context from a temp HOME',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const tempHome = await createConfigBackedReadOnlyHome(readOnlyEnv);

      try {
        const configBackedCliEnv = toConfigBackedReadOnlyCliEnv(
          readOnlyEnv,
          tempHome.path
        );

        const lbList = await runJsonCommand<LbListJson>(
          ['lb', 'list'],
          configBackedCliEnv
        );

        expect(lbList.action).toBe('list');
        expect(Array.isArray(lbList.items)).toBe(true);

        const lbPlans = await runJsonCommand<LbPlansJson>(
          ['lb', 'plans'],
          configBackedCliEnv
        );

        expect(lbPlans.action).toBe('plans');
        expect(Array.isArray(lbPlans.items)).toBe(true);
        expect(lbPlans.items.length).toBeGreaterThan(0);

        const sslList = await runJsonCommand<SslListJson>(
          ['ssl', 'list'],
          configBackedCliEnv
        );

        expect(sslList.action).toBe('list');
        expect(Array.isArray(sslList.items)).toBe(true);
      } finally {
        await tempHome.cleanup();
      }
    }
  );

  it(
    'covers lb list and lb plans via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const lbList = await runJsonCommand<LbListJson>(['lb', 'list']);

      expect(lbList.action).toBe('list');
      expect(Array.isArray(lbList.items)).toBe(true);

      const lbPlans = await runJsonCommand<LbPlansJson>(['lb', 'plans']);

      expect(lbPlans.action).toBe('plans');
      expect(Array.isArray(lbPlans.items)).toBe(true);
      expect(lbPlans.items.length).toBeGreaterThan(0);
      expect(lbPlans.items[0]).toHaveProperty('name');
      expect(lbPlans.items[0]).toHaveProperty('hourly');
    }
  );

  it(
    'covers ssl list via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const sslList = await runJsonCommand<SslListJson>(['ssl', 'list']);

      expect(sslList.action).toBe('list');
      expect(Array.isArray(sslList.items)).toBe(true);
    }
  );

  itWithLbId(
    'reads a specific load balancer when E2ECTL_MANUAL_LB_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const lbId = process.env.E2ECTL_MANUAL_LB_ID!;
      const response = await runJsonCommand<LbGetJson>(['lb', 'get', lbId]);

      expect(response.action).toBe('get');
      expect(String(response.item.id)).toBe(lbId);
      expect(response.item.lb_mode).toBeDefined();
      expect(response.item.status).toBeDefined();
    }
  );
});

async function runJsonCommand<T>(
  args: string[],
  cliEnv: NodeJS.ProcessEnv = readOnlyEnv.cliEnv
): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: cliEnv,
    timeoutMs: MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS
  });

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: e2ectl ${args.join(' ')}`,
        result.stderr.trim().length === 0
          ? 'STDERR: <empty>'
          : `STDERR: ${result.stderr.trim()}`,
        result.stdout.trim().length === 0
          ? 'STDOUT: <empty>'
          : `STDOUT: ${result.stdout.trim()}`
      ].join('\n')
    );
  }

  return parseJsonCommandResult<T>(args, result.stdout);
}

function parseJsonCommandResult<T>(args: string[], stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (error: unknown) {
    throw new Error(
      `Command returned invalid JSON for e2ectl ${args.join(' ')}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
