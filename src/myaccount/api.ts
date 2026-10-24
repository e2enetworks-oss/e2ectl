import { formatCliCommand } from '../app/metadata.js';
import {
  HttpTransport,
  type ApiClientCredentials,
  type ApiClientOptions,
  type ApiTransport
} from '../http/index.js';

const MYACCOUNT_COMMAND = 'myaccount';

export function createMyAccountTransport(
  credentials: ApiClientCredentials,
  options: ApiClientOptions = {}
): ApiTransport {
  return new HttpTransport(credentials, { ...options, apiName: 'MyAccount' });
}

// Builds a MyAccount command for hints and errors, for example
// formatMyAccountCommand('node list') gives "e2ectl myaccount node list".
export function formatMyAccountCommand(argumentsText: string): string {
  return formatCliCommand(`${MYACCOUNT_COMMAND} ${argumentsText}`);
}
