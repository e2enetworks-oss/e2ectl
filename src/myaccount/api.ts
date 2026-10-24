import { formatCliCommand } from '../app/metadata.js';
import {
  HttpTransport,
  type ApiClientCredentials,
  type ApiClientOptions,
  type ApiTransport,
  type ProjectContextOptions
} from '../http/index.js';

const MYACCOUNT_COMMAND = 'myaccount';

// Every MyAccount request carries a project and location unless the call
// turns it off.
export const MYACCOUNT_PROJECT_CONTEXT: ProjectContextOptions = {
  missingContextSuggestion:
    'Pass --project-id and --location, set E2E_PROJECT_ID and E2E_LOCATION, or save default project/location values on the selected profile.'
};

export function createMyAccountTransport(
  credentials: ApiClientCredentials,
  options: ApiClientOptions = {}
): ApiTransport {
  return new HttpTransport(credentials, {
    ...options,
    apiName: 'MyAccount',
    projectContext: MYACCOUNT_PROJECT_CONTEXT
  });
}

// Builds a MyAccount command for hints and errors, for example
// formatMyAccountCommand('node list') gives "e2ectl myaccount node list".
export function formatMyAccountCommand(argumentsText: string): string {
  return formatCliCommand(`${MYACCOUNT_COMMAND} ${argumentsText}`);
}
