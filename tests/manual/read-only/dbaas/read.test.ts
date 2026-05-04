// NOTE: This file follows the per-resource test structure.
// For other resources still in the old structure, see tests/manual/read-only/node-read.test.ts
// TODO: Refactor other resources (node, volume, vpc, security-group, ssh-key, reserved-ip, project)
//       into per-resource subdirectories per tests/manual/STRUCTURE.md

import { access } from 'node:fs/promises';
import path from 'node:path';

import {
  readReadOnlyEnv,
  type ReadOnlyEnv
} from '../../helpers/read-only-env.js';
import { runBuiltCli } from '../../../helpers/process.js';
import { createConfigBackedReadOnlyHome } from '../../helpers/read-only-profile.js';
import {
  toDbaasTypeFlag,
  type DbaasGetJson,
  type DbaasListJson,
  type DbaasListTypesJson,
  type DbaasPlansJson
} from '../../helpers/dbaas-helpers.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;

const itWithDbaasId = process.env.E2ECTL_MANUAL_DBAAS_ID ? it : it.skip;

const MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS = 60 * 1000;
const MANUAL_READ_ONLY_TEST_TIMEOUT_MS = 10 * 60 * 1000;

let readOnlyEnv: ReadOnlyEnv;

describeManual('manual DBaaS read-only built CLI checks', () => {
  beforeAll(async () => {
    readOnlyEnv = readReadOnlyEnv();

    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'covers dbaas catalog-safe flows via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const tempHome = await createConfigBackedReadOnlyHome(readOnlyEnv);

      try {
        const configBackedCliEnv = {
          HOME: tempHome.path,
          ...readOnlyEnv.cliEnv
        };

        const listTypes = await runJsonCommand<DbaasListTypesJson>(
          ['dbaas', 'types'],
          configBackedCliEnv
        );

        expect(listTypes.action).toBe('types');
        expect(listTypes.items.length).toBeGreaterThan(0);

        const engine = listTypes.items[0];

        expect(engine).toBeDefined();

        const plans = await runJsonCommand<DbaasPlansJson>(
          [
            'dbaas',
            'plans',
            '--type',
            toDbaasTypeFlag(engine!.type),
            '--db-version',
            engine!.version
          ],
          configBackedCliEnv
        );

        expect(plans.action).toBe('plans');
        expect(Array.isArray(plans.items)).toBe(true);
      } finally {
        await tempHome.cleanup();
      }
    }
  );

  it(
    'covers dbaas list-safe flows via the built CLI',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const list = await runJsonCommand<DbaasListJson>(['dbaas', 'list']);

      expect(list.action).toBe('list');
      expect(Array.isArray(list.items)).toBe(true);
    }
  );

  itWithDbaasId(
    'reads a specific dbaas cluster when E2ECTL_MANUAL_DBAAS_ID is provided',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const dbaasId = readOnlyEnv.fixtures.dbaasId!;
      const response = await runJsonCommand<DbaasGetJson>([
        'dbaas',
        'get',
        dbaasId
      ]);

      expect(response.action).toBe('get');
      expect(String(response.dbaas.id)).toBe(dbaasId);
    }
  );

  it(
    'renders dbaas list in human mode',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const result = await runBuiltCli(['dbaas', 'list'], {
        env: readOnlyEnv.cliEnv,
        timeoutMs: MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      // Human output should contain headers OR empty state message
      const hasHeaders =
        result.stdout.includes('ID') &&
        result.stdout.includes('Name') &&
        result.stdout.includes('DB Version');
      const isEmptyState = result.stdout.includes(
        'No supported DBaaS clusters'
      );
      expect(hasHeaders || isEmptyState).toBe(true);
    }
  );

  it(
    'renders dbaas types in human mode',
    { timeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS },
    async () => {
      const result = await runBuiltCli(['dbaas', 'types'], {
        env: readOnlyEnv.cliEnv,
        timeoutMs: MANUAL_READ_ONLY_COMMAND_TIMEOUT_MS
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      // Human output should contain expected headers
      expect(result.stdout).toContain('Type');
      expect(result.stdout).toContain('Version');
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
