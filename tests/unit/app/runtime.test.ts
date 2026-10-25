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
import {
  ApiCredentialValidator,
  type ResolvedAccountCredentials,
  type ResolvedCredentials
} from '../../../src/config/index.js';
import { HttpTransport } from '../../../src/http/index.js';
import { ImageApiClient } from '../../../src/myaccount/image/index.js';
import { NodeApiClient } from '../../../src/myaccount/node/index.js';
import { ProjectApiClient } from '../../../src/myaccount/project/index.js';
import { ReservedIpApiClient } from '../../../src/myaccount/reserved-ip/index.js';
import { SecurityGroupApiClient } from '../../../src/myaccount/security-group/index.js';
import { SshKeyApiClient } from '../../../src/myaccount/ssh-key/index.js';
import { VolumeApiClient } from '../../../src/myaccount/volume/index.js';
import { VpcApiClient } from '../../../src/myaccount/vpc/index.js';

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
      project_id: '12345'
    };
    const resolvedAccountCredentials: ResolvedAccountCredentials = {
      api_key: 'api-key',
      auth_token: 'auth-token'
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
      imageClient as unknown as { transport: HttpTransport }
    ).transport as unknown as { baseUrl: string };

    expect(imageTransport).toBeInstanceOf(HttpTransport);
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
