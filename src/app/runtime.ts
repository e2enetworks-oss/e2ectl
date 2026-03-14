import { createInterface } from 'node:readline/promises';

import {
  ApiCredentialValidator,
  type ApiClientOptions,
  type CredentialValidator,
  MyAccountApiTransport
} from '../myaccount/index.js';
import { ConfigStore, type ResolvedCredentials } from '../config/index.js';
import { NodeApiClient, type NodeClient } from '../node/index.js';
import { SshKeyApiClient, type SshKeyClient } from '../ssh-key/index.js';
import { VolumeApiClient, type VolumeClient } from '../volume/index.js';
import { VpcApiClient, type VpcClient } from '../vpc/index.js';

export interface OutputWriter {
  write(chunk: string): void;
}

export interface CliRuntime {
  confirm(message: string): Promise<boolean>;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  createVolumeClient(credentials: ResolvedCredentials): VolumeClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  credentialValidator: CredentialValidator;
  isInteractive: boolean;
  prompt(message: string): Promise<string>;
  stderr: OutputWriter;
  stdout: OutputWriter;
  store: ConfigStore;
}

// Internal test hook for pointing the compiled CLI at a fake MyAccount server.
export const MYACCOUNT_BASE_URL_ENV_VAR = 'E2ECTL_MYACCOUNT_BASE_URL';

export function createRuntime(): CliRuntime {
  const apiClientOptions = readApiClientOptions();

  return {
    confirm: promptForConfirmation,
    createNodeClient: (credentials) =>
      new NodeApiClient(
        new MyAccountApiTransport(credentials, apiClientOptions)
      ),
    createSshKeyClient: (credentials) =>
      new SshKeyApiClient(
        new MyAccountApiTransport(credentials, apiClientOptions)
      ),
    createVolumeClient: (credentials) =>
      new VolumeApiClient(
        new MyAccountApiTransport(credentials, apiClientOptions)
      ),
    createVpcClient: (credentials) =>
      new VpcApiClient(
        new MyAccountApiTransport(credentials, apiClientOptions)
      ),
    credentialValidator: new ApiCredentialValidator(apiClientOptions),
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: promptForInput,
    stderr: process.stderr,
    stdout: process.stdout,
    store: new ConfigStore()
  };
}

function readApiClientOptions(
  env: NodeJS.ProcessEnv = process.env
): ApiClientOptions {
  const baseUrl = env[MYACCOUNT_BASE_URL_ENV_VAR]?.trim();

  return baseUrl === undefined || baseUrl.length === 0 ? {} : { baseUrl };
}

async function promptForConfirmation(message: string): Promise<boolean> {
  const prompt = `${message} [y/N] `;
  const answer = await promptForInput(prompt);
  return /^(y|yes)$/i.test(answer.trim());
}

async function promptForInput(message: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return await readline.question(message);
  } finally {
    readline.close();
  }
}
