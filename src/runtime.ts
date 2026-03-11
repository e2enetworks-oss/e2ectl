import { MyAccountApiClient, type MyAccountClient } from './client/api.js';
import {
  ApiCredentialValidator,
  type CredentialValidator
} from './client/credential-validator.js';
import { ConfigStore } from './config/store.js';
import type { ResolvedCredentials } from './types/config.js';

export interface OutputWriter {
  write(chunk: string): void;
}

export interface CliRuntime {
  createApiClient(credentials: ResolvedCredentials): MyAccountClient;
  credentialValidator: CredentialValidator;
  stderr: OutputWriter;
  stdout: OutputWriter;
  store: ConfigStore;
}

export function createRuntime(): CliRuntime {
  return {
    createApiClient: (credentials) => new MyAccountApiClient(credentials),
    credentialValidator: new ApiCredentialValidator(),
    stderr: process.stderr,
    stdout: process.stdout,
    store: new ConfigStore()
  };
}
