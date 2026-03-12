import { createInterface } from 'node:readline/promises';

import {
  ApiCredentialValidator,
  type CredentialValidator,
  MyAccountApiTransport
} from '../myaccount/index.js';
import { ConfigStore, type ResolvedCredentials } from '../config/index.js';
import { NodeApiClient, type NodeClient } from '../node/index.js';

export interface OutputWriter {
  write(chunk: string): void;
}

export interface CliRuntime {
  confirm(message: string): Promise<boolean>;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
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
    createNodeClient: (credentials) =>
      new NodeApiClient(new MyAccountApiTransport(credentials)),
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
