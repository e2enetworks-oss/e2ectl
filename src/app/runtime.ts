import { createInterface } from 'node:readline/promises';

import {
  ApiCredentialValidator,
  type CredentialValidator,
  MyAccountApiClient,
  type MyAccountClient
} from '../myaccount/index.js';
import { ConfigStore, type ResolvedCredentials } from '../config/index.js';

export interface OutputWriter {
  write(chunk: string): void;
}

export interface CliRuntime {
  confirm(message: string): Promise<boolean>;
  createApiClient(credentials: ResolvedCredentials): MyAccountClient;
  credentialValidator: CredentialValidator;
  isInteractive: boolean;
  prompt(message: string): Promise<string>;
  stderr: OutputWriter;
  stdout: OutputWriter;
  store: ConfigStore;
}

export function createRuntime(): CliRuntime {
  return {
    confirm: promptForConfirmation,
    createApiClient: (credentials) => new MyAccountApiClient(credentials),
    credentialValidator: new ApiCredentialValidator(),
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: promptForInput,
    stderr: process.stderr,
    stdout: process.stdout,
    store: new ConfigStore()
  };
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
