import { mkdtemp, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { ConfigStore } from '../../../src/config/store.js';
import {
  pathsReferToSameFile,
  runCli,
  type CliRuntime
} from '../../../src/app/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../helpers/runtime.js';

describe('runCli', () => {
  function createRuntimeFixture(options?: { isInteractive?: boolean }): {
    runtime: CliRuntime;
    stderr: MemoryWriter;
    stdout: MemoryWriter;
  } {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    return {
      runtime: createTestRuntime({
        isInteractive: options?.isInteractive ?? true,
        stderr,
        stdout,
        store: new ConfigStore({
          configPath: createTestConfigPath('app-cli')
        })
      }),
      stderr,
      stdout
    };
  }

  it.each([['--no-input'], ['--json']])(
    'turns prompts off with %s, even in a terminal',
    async (flag) => {
      const { runtime, stderr } = createRuntimeFixture({ isInteractive: true });

      const exitCode = await runCli(
        ['node', CLI_COMMAND_NAME, flag, 'configure'],
        runtime,
        stderr
      );

      expect(runtime.isInteractive).toBe(false);
      expect(exitCode).toBe(2);
      expect(stderr.buffer).toContain('Choose at least one platform.');
    }
  );

  it('formats missing required options as CLI usage errors', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      [
        'node',
        CLI_COMMAND_NAME,
        'myaccount',
        'node',
        'create',
        '--plan',
        'plan-123'
      ],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      "Error: required option '--name <name>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it.each([
    [
      ['node', 'list'],
      'Error: Unknown command "node".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount node list"?\n'
    ],
    [
      ['node', 'get', '123', '--alias', 'prod', '--json'],
      'Error: Unknown command "node".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount node get"?\n'
    ],
    [
      ['--json', 'dbaas', 'create', '--password', 'secret-value'],
      'Error: Unknown command "dbaas".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount dbaas create"?\n'
    ],
    [
      ['list'],
      'Error: Unknown command "list".\n\nNext step: Run e2ectl --help to see the commands.\n'
    ],
    [
      ['confg', 'list'],
      'Error: Unknown command "confg".\n\nNext step: Did you mean "e2ectl config"? Run e2ectl --help to see the commands.\n'
    ],
    [
      ['myaccount', 'node', 'lst'],
      'Error: Unknown command "lst".\n\nNext step: Did you mean "e2ectl myaccount node list"? Run e2ectl myaccount node --help to see the commands.\n'
    ],
    [
      ['myaccount', 'nod', 'list', '--alias', 'prod'],
      'Error: Unknown command "nod".\n\nNext step: Did you mean "e2ectl myaccount node"? Run e2ectl myaccount --help to see the commands.\n'
    ],
    [
      ['myaccount', '--json', 'nod', 'list'],
      'Error: Unknown command "nod".\n\nNext step: Did you mean "e2ectl myaccount node"? Run e2ectl myaccount --help to see the commands.\n'
    ],
    [
      ['nod', 'list', '--alias', 'prod'],
      'Error: Unknown command "nod".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount node list"?\n'
    ],
    [
      ['dbaas', 'create', 'hunter2'],
      'Error: Unknown command "dbaas".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount dbaas create"?\n'
    ],
    [
      ['ls'],
      'Error: Unknown command "ls".\n\nNext step: Run e2ectl --help to see the commands.\n'
    ],
    [
      ['myaccount', 'rm'],
      'Error: Unknown command "rm".\n\nNext step: Run e2ectl myaccount --help to see the commands.\n'
    ],
    [
      ['help', 'node'],
      'Error: Unknown command "node".\n\nNext step: Commands now start with the platform name. Did you mean "e2ectl myaccount node"?\n'
    ],
    [
      ['xyz', '--alias', 'prod'],
      'Error: Unknown command "xyz".\n\nNext step: Run e2ectl --help to see the commands.\n'
    ]
  ])('names an unknown command in %j', async (args, expected) => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, ...args],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    if (!args.includes('--json')) {
      expect(stderr.buffer).toBe(expected);
      return;
    }

    // With --json the same facts come as a JSON error.
    const { error } = JSON.parse(stderr.buffer) as {
      error: {
        code: string;
        exit_code: number;
        message: string;
        next_step: string;
      };
    };
    expect(`Error: ${error.message}\n\nNext step: ${error.next_step}\n`).toBe(
      expected
    );
    expect(error).toMatchObject({ code: 'UNKNOWN_COMMAND', exit_code: 2 });
  });

  it.each([
    [['help', 'myaccount']],
    [['myaccount', 'help', 'node']],
    [['myaccount', 'node', 'help', 'list']],
    [['help', 'myaccount', 'node', 'snapshot']]
  ])('exits 0 after showing help through %j', async (args) => {
    const { runtime, stderr } = createRuntimeFixture();
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    try {
      const exitCode = await runCli(
        ['node', CLI_COMMAND_NAME, ...args],
        runtime,
        stderr
      );

      expect(exitCode).toBe(0);
      expect(stderr.buffer).toBe('');
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      // help follows every word, down to the last command named.
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Usage: e2ectl ${args.filter((arg) => arg !== 'help').join(' ')}`
        )
      );
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('still shows help for a command group typed on its own', async () => {
    const { runtime, stderr } = createRuntimeFixture();
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    try {
      const exitCode = await runCli(
        ['node', CLI_COMMAND_NAME, 'myaccount'],
        runtime,
        stderr
      );

      expect(exitCode).toBe(0);
      expect(stderr.buffer).toBe('');
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: e2ectl myaccount')
      );
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('formats invalid node ids through the same CLI contract', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, 'myaccount', 'node', 'get', 'node-abc'],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      'Error: Node ID must be numeric.\n\nNext step: Pass the numeric node id as the first argument.\n'
    );
  });

  it('formats non-interactive delete confirmation failures through the same CLI contract', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture({
      isInteractive: false
    });

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, 'myaccount', 'node', 'delete', '101'],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      'Error: Deleting a node requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
    );
  });

  it('treats symlinked entrypoints as the same file for npm-linked installs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-app-link-'));
    const actualPath = fileURLToPath(import.meta.url);
    const symlinkPath = path.join(root, 'linked-index-test.ts');

    await symlink(actualPath, symlinkPath);

    expect(pathsReferToSameFile(symlinkPath, actualPath)).toBe(true);
  });

  it('compares unresolved paths when realpath lookup fails', () => {
    const missingPath = path.join(
      os.tmpdir(),
      'e2ectl-missing-entrypoint-for-test.js'
    );

    expect(pathsReferToSameFile(missingPath, missingPath)).toBe(true);
  });
});
