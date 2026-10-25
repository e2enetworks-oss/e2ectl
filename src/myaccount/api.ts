import { formatCliCommand } from '../app/metadata.js';
import {
  HttpTransport,
  type ApiClientCredentials,
  type ApiClientOptions,
  type ApiTransport,
  type TransportProjectContext
} from '../http/index.js';

const MYACCOUNT_COMMAND = 'myaccount';

const MYACCOUNT_API_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';

// Every MyAccount request carries a project and location unless the call
// turns it off.
const MYACCOUNT_PROJECT_CONTEXT: TransportProjectContext = {
  missingContextSuggestion: `Run \`${formatMyAccountCommand('configure')}\`, pass --project-id and --location, or set E2E_PROJECT_ID and E2E_LOCATION.`
};

export function createMyAccountTransport(
  credentials: ApiClientCredentials,
  options: ApiClientOptions = {}
): ApiTransport {
  return new HttpTransport(credentials, {
    ...options,
    apiName: 'MyAccount',
    baseUrl: options.baseUrl ?? MYACCOUNT_API_BASE_URL,
    projectContext: MYACCOUNT_PROJECT_CONTEXT
  });
}

// Builds a MyAccount command for hints and errors, for example
// formatMyAccountCommand('node list') gives "e2ectl myaccount node list".
export function formatMyAccountCommand(argumentsText: string): string {
  return formatCliCommand(`${MYACCOUNT_COMMAND} ${argumentsText}`);
}
