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
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

describe('runCli', () => {
  function createRuntimeFixture(options?: { isInteractive?: boolean }): {
    runtime: CliRuntime;
    stderr: MemoryWriter;
    stdout: MemoryWriter;
  } {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    return {
      runtime: {
        confirm: vi.fn(() => Promise.resolve(false)),
        createImageClient: vi.fn(() => {
          throw new Error('Image client should not be created for this test.');
        }),
        createNodeClient: vi.fn(() => {
          throw new Error('Node client should not be created for this test.');
        }),
        createProjectClient: vi.fn(() => {
          throw new Error(
            'Project client should not be created for this test.'
          );
        }),
        createReservedIpClient: vi.fn(() => {
          throw new Error(
            'Reserved IP client should not be created for this test.'
          );
        }),
        createSecurityGroupClient: vi.fn(() => {
          throw new Error(
            'Security group client should not be created for this test.'
          );
        }),
        createSshKeyClient: vi.fn(() => {
          throw new Error(
            'SSH key client should not be created for this test.'
          );
        }),
        createLoadBalancerClient: vi.fn(() => {
          throw new Error(
            'Load balancer client should not be created for this test.'
          );
        }),
        createVolumeClient: vi.fn(() => {
          throw new Error('Volume client should not be created for this test.');
        }),
        createVpcClient: vi.fn(() => {
          throw new Error('VPC client should not be created for this test.');
        }),
        credentialValidator: {
          validate: vi.fn()
        },
        isInteractive: options?.isInteractive ?? true,
        prompt: vi.fn(() => Promise.resolve('')),
        stderr,
        stdout,
        store: new ConfigStore({
          configPath: createTestConfigPath('app-cli')
        })
      },
      stderr,
      stdout
    };
  }

  it('formats missing required options as CLI usage errors', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, 'node', 'create', '--plan', 'plan-123'],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      "Error: required option '--name <name>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('formats invalid node ids through the same CLI contract', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, 'node', 'get', 'node-abc'],
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
      ['node', CLI_COMMAND_NAME, 'node', 'delete', '101'],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      'Error: Deleting a node requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
    );
  });

  it('rejects the retired load-balancer command alias before command parsing', async () => {
    const { runtime, stderr, stdout } = createRuntimeFixture();

    const exitCode = await runCli(
      ['node', CLI_COMMAND_NAME, 'load-balancer', 'list'],
      runtime,
      stderr
    );

    expect(exitCode).toBe(2);
    expect(stdout.buffer).toBe('');
    expect(stderr.buffer).toBe(
      'Error: Unknown command "load-balancer".\n\nNext step: Use "lb" instead.\n'
    );
  });

  it('rejects retired lb backend group and server command aliases', async () => {
    const { runtime, stderr } = createRuntimeFixture();

    await expect(
      runCli(
        ['node', CLI_COMMAND_NAME, 'lb', 'backend', 'group', 'add'],
        runtime,
        stderr
      )
    ).resolves.toBe(2);
    expect(stderr.buffer).toBe(
      'Error: Unknown command "lb backend group".\n\nNext step: Use "lb backend-group" instead.\n'
    );

    stderr.buffer = '';

    await expect(
      runCli(
        ['node', CLI_COMMAND_NAME, 'lb', 'backend', 'server', 'add'],
        runtime,
        stderr
      )
    ).resolves.toBe(2);
    expect(stderr.buffer).toBe(
      'Error: Unknown command "lb backend server".\n\nNext step: Use "lb backend-server" instead.\n'
    );
  });

  it('rejects retired lb network reserve-ip attach/detach aliases', async () => {
    const { runtime, stderr } = createRuntimeFixture();

    await expect(
      runCli(
        [
          'node',
          CLI_COMMAND_NAME,
          'lb',
          'network',
          'reserve-ip',
          'attach',
          '10'
        ],
        runtime,
        stderr
      )
    ).resolves.toBe(2);

    expect(stderr.buffer).toBe(
      'Error: Unknown command "lb network reserve-ip attach".\n\nNext step: Use "lb network reserve-ip reserve <lbId>" to reserve the current public IP.\n'
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
