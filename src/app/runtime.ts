import { createInterface } from 'node:readline/promises';

import type { ApiClientOptions } from '../http/index.js';
import {
  ApiCredentialValidator,
  ConfigStore,
  type CredentialValidator,
  type ResolvedAccountCredentials,
  type ResolvedCredentials,
  type ResolvedTirCredentials
} from '../config/index.js';
import { createMyAccountTransport } from '../myaccount/api.js';
import { ImageApiClient, type ImageClient } from '../myaccount/image/index.js';
import { DbaasApiClient, type DbaasClient } from '../myaccount/dbaas/index.js';
import {
  LoadBalancerApiClient,
  type LoadBalancerClient
} from '../myaccount/load-balancer/index.js';
import { NodeApiClient, type NodeClient } from '../myaccount/node/index.js';
import {
  ProjectApiClient,
  type ProjectClient
} from '../myaccount/project/index.js';
import {
  ReservedIpApiClient,
  type ReservedIpClient
} from '../myaccount/reserved-ip/index.js';
import {
  SecurityGroupApiClient,
  type SecurityGroupClient
} from '../myaccount/security-group/index.js';
import {
  SshKeyApiClient,
  type SshKeyClient
} from '../myaccount/ssh-key/index.js';
import { SslApiClient, type SslClient } from '../myaccount/ssl/index.js';
import {
  SupportTicketApiClient,
  type SupportTicketClient
} from '../myaccount/support-ticket/index.js';
import {
  VolumeApiClient,
  type VolumeClient
} from '../myaccount/volume/index.js';
import { VpcApiClient, type VpcClient } from '../myaccount/vpc/index.js';
import {
  TirAccountApiClient,
  type TirAccountClient
} from '../tir/account/index.js';
import { createTirTransport } from '../tir/api.js';
import {
  TirProjectApiClient,
  type TirProjectClient
} from '../tir/project/index.js';
import { TirImageApiClient, type TirImageClient } from '../tir/image/index.js';
import { TirPlanApiClient, type TirPlanClient } from '../tir/plan/index.js';

export interface OutputWriter {
  write(chunk: string): void;
}

export interface CliRuntime {
  confirm(message: string): Promise<boolean>;
  createImageClient(credentials: ResolvedCredentials): ImageClient;
  createDbaasClient(credentials: ResolvedCredentials): DbaasClient;
  createLoadBalancerClient(
    credentials: ResolvedCredentials
  ): LoadBalancerClient;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  createProjectClient(credentials: ResolvedAccountCredentials): ProjectClient;
  createReservedIpClient(credentials: ResolvedCredentials): ReservedIpClient;
  createSecurityGroupClient(
    credentials: ResolvedCredentials
  ): SecurityGroupClient;
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  createSslClient(credentials: ResolvedCredentials): SslClient;
  createSupportTicketClient(
    credentials: ResolvedCredentials
  ): SupportTicketClient;
  createVolumeClient(credentials: ResolvedCredentials): VolumeClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  createTirAccountClient(credentials: ResolvedTirCredentials): TirAccountClient;
  createTirProjectClient(credentials: ResolvedTirCredentials): TirProjectClient;
  createTirImageClient(credentials: ResolvedTirCredentials): TirImageClient;
  createTirPlanClient(credentials: ResolvedTirCredentials): TirPlanClient;
  credentialValidator: CredentialValidator;
  isInteractive: boolean;
  prompt(message: string): Promise<string>;
  stderr: OutputWriter;
  stdout: OutputWriter;
  store: ConfigStore;
}

// Internal test hooks for pointing the compiled CLI at a fake API server.
export const MYACCOUNT_BASE_URL_ENV_VAR = 'E2ECTL_MYACCOUNT_BASE_URL';
export const TIR_BASE_URL_ENV_VAR = 'E2ECTL_TIR_BASE_URL';

export function createRuntime(): CliRuntime {
  const apiClientOptions = readApiClientOptions(MYACCOUNT_BASE_URL_ENV_VAR);
  const tirApiClientOptions = readApiClientOptions(TIR_BASE_URL_ENV_VAR);

  return {
    confirm: promptForConfirmation,
    createImageClient: (credentials) =>
      new ImageApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createDbaasClient: (credentials) =>
      new DbaasApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createLoadBalancerClient: (credentials) =>
      new LoadBalancerApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createNodeClient: (credentials) =>
      new NodeApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createProjectClient: (credentials) =>
      new ProjectApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createReservedIpClient: (credentials) =>
      new ReservedIpApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createSecurityGroupClient: (credentials) =>
      new SecurityGroupApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createSshKeyClient: (credentials) =>
      new SshKeyApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createSslClient: (credentials) =>
      new SslApiClient(createMyAccountTransport(credentials, apiClientOptions)),
    createSupportTicketClient: (credentials) =>
      new SupportTicketApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createVolumeClient: (credentials) =>
      new VolumeApiClient(
        createMyAccountTransport(credentials, apiClientOptions)
      ),
    createVpcClient: (credentials) =>
      new VpcApiClient(createMyAccountTransport(credentials, apiClientOptions)),
    createTirAccountClient: (credentials) =>
      new TirAccountApiClient(
        createTirTransport(credentials, tirApiClientOptions)
      ),
    createTirProjectClient: (credentials) =>
      new TirProjectApiClient(
        createTirTransport(credentials, tirApiClientOptions)
      ),
    createTirImageClient: (credentials) =>
      new TirImageApiClient(
        createTirTransport(credentials, tirApiClientOptions)
      ),
    createTirPlanClient: (credentials) =>
      new TirPlanApiClient(
        createTirTransport(credentials, tirApiClientOptions)
      ),
    credentialValidator: new ApiCredentialValidator((credentials) =>
      createMyAccountTransport(credentials, apiClientOptions)
    ),
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: promptForInput,
    stderr: process.stderr,
    stdout: process.stdout,
    store: new ConfigStore()
  };
}

function readApiClientOptions(
  envVarName: string,
  env: NodeJS.ProcessEnv = process.env
): ApiClientOptions {
  const baseUrl = env[envVarName]?.trim();

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
