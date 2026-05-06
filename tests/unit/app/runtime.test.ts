const readlineMocks = vi.hoisted(() => {
  const question = vi.fn();
  const close = vi.fn();
  const createInterface = vi.fn(() => ({
    close,
    question
  }));

  return {
    close,
    createInterface,
    question
  };
});

vi.mock('node:readline/promises', () => ({
  createInterface: readlineMocks.createInterface
}));

import { ConfigStore } from '../../../src/config/index.js';
import {
  createRuntime,
  MYACCOUNT_BASE_URL_ENV_VAR
} from '../../../src/app/runtime.js';
import type {
  ResolvedAccountCredentials,
  ResolvedCredentials
} from '../../../src/config/index.js';
import {
  ApiCredentialValidator,
  MyAccountApiTransport
} from '../../../src/myaccount/index.js';
import { ImageApiClient } from '../../../src/image/index.js';
import { NodeApiClient } from '../../../src/node/index.js';
import { ProjectApiClient } from '../../../src/project/index.js';
import { ReservedIpApiClient } from '../../../src/reserved-ip/index.js';
import { SecurityGroupApiClient } from '../../../src/security-group/index.js';
import { SshKeyApiClient } from '../../../src/ssh-key/index.js';
import { VolumeApiClient } from '../../../src/volume/index.js';
import { VpcApiClient } from '../../../src/vpc/index.js';

describe('createRuntime', () => {
  const stdinTtyDescriptor = Object.getOwnPropertyDescriptor(
    process.stdin,
    'isTTY'
  );
  const stdoutTtyDescriptor = Object.getOwnPropertyDescriptor(
    process.stdout,
    'isTTY'
  );

  afterEach(() => {
    readlineMocks.question.mockReset();
    readlineMocks.close.mockReset();
    readlineMocks.createInterface.mockClear();
    vi.unstubAllEnvs();

    if (stdinTtyDescriptor !== undefined) {
      Object.defineProperty(process.stdin, 'isTTY', stdinTtyDescriptor);
    }

    if (stdoutTtyDescriptor !== undefined) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutTtyDescriptor);
    }
  });

  it('creates typed clients and runtime defaults', () => {
    vi.stubEnv(MYACCOUNT_BASE_URL_ENV_VAR, 'https://example.com/custom-base');
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true
    });

    const runtime = createRuntime();
    const resolvedCredentials: ResolvedCredentials = {
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token',
      location: 'Delhi',
      project_id: '12345',
      source: 'profile'
    };
    const resolvedAccountCredentials: ResolvedAccountCredentials = {
      api_key: 'api-key',
      auth_token: 'auth-token',
      source: 'env'
    };

    expect(runtime.credentialValidator).toBeInstanceOf(ApiCredentialValidator);
    expect(runtime.store).toBeInstanceOf(ConfigStore);
    expect(runtime.isInteractive).toBe(true);

    const imageClient = runtime.createImageClient(resolvedCredentials);
    const nodeClient = runtime.createNodeClient(resolvedCredentials);
    const projectClient = runtime.createProjectClient(
      resolvedAccountCredentials
    );
    const reservedIpClient =
      runtime.createReservedIpClient(resolvedCredentials);
    const securityGroupClient =
      runtime.createSecurityGroupClient(resolvedCredentials);
    const sshKeyClient = runtime.createSshKeyClient(resolvedCredentials);
    const volumeClient = runtime.createVolumeClient(resolvedCredentials);
    const vpcClient = runtime.createVpcClient(resolvedCredentials);

    expect(imageClient).toBeInstanceOf(ImageApiClient);
    expect(nodeClient).toBeInstanceOf(NodeApiClient);
    expect(projectClient).toBeInstanceOf(ProjectApiClient);
    expect(reservedIpClient).toBeInstanceOf(ReservedIpApiClient);
    expect(securityGroupClient).toBeInstanceOf(SecurityGroupApiClient);
    expect(sshKeyClient).toBeInstanceOf(SshKeyApiClient);
    expect(volumeClient).toBeInstanceOf(VolumeApiClient);
    expect(vpcClient).toBeInstanceOf(VpcApiClient);

    const imageTransport = (
      imageClient as unknown as { transport: MyAccountApiTransport }
    ).transport as unknown as { baseUrl: string };

    expect(imageTransport).toBeInstanceOf(MyAccountApiTransport);
    expect(imageTransport.baseUrl).toBe('https://example.com/custom-base/');
  });

  it('computes a non-interactive runtime when either tty is missing', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false
    });

    expect(createRuntime().isInteractive).toBe(false);
  });

  it('prompts for input, confirms yes answers, and closes readline handles', async () => {
    readlineMocks.question
      .mockResolvedValueOnce('hello')
      .mockResolvedValueOnce(' yes ')
      .mockResolvedValueOnce('no');

    const runtime = createRuntime();

    await expect(runtime.prompt('Enter value: ')).resolves.toBe('hello');
    await expect(runtime.confirm('Continue?')).resolves.toBe(true);
    await expect(runtime.confirm('Continue?')).resolves.toBe(false);

    expect(readlineMocks.createInterface).toHaveBeenCalledTimes(3);
    expect(readlineMocks.question).toHaveBeenNthCalledWith(1, 'Enter value: ');
    expect(readlineMocks.question).toHaveBeenNthCalledWith(
      2,
      'Continue? [y/N] '
    );
    expect(readlineMocks.question).toHaveBeenNthCalledWith(
      3,
      'Continue? [y/N] '
    );
    expect(readlineMocks.close).toHaveBeenCalledTimes(3);
  });
});
