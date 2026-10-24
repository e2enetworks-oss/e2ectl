import { formatCliCommand } from '../app/metadata.js';
import {
  HttpTransport,
  type ApiClientCredentials,
  type ApiClientOptions,
  type ApiTransport,
  type TransportProjectContext
} from '../http/index.js';

const TIR_COMMAND = 'tir';

// TIR uses the same key and token as MyAccount, on its own path.
const TIR_API_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1/gpu';

// Project calls carry the account (active_iam), project and location.
const TIR_PROJECT_CONTEXT: TransportProjectContext = {
  accountParameter: 'active_iam',
  missingContextSuggestion: `Run \`${formatTirCommand('project list')}\`, then \`${formatTirCommand('configure --account-id <id> --project-id <id> --location <Delhi|Chennai>')}\`.`
};

// TIR answers 403 for an account or project the key cannot use, not only
// for a bad key.
const TIR_FORBIDDEN_SUGGESTION = `Check the TIR account and project: run \`${formatTirCommand('account list')}\` and \`${formatTirCommand('project list')}\`, then \`${formatTirCommand('configure')}\` with ones you can use.`;

export function createTirTransport(
  credentials: ApiClientCredentials,
  options: ApiClientOptions = {}
): ApiTransport {
  return new HttpTransport(credentials, {
    ...options,
    apiName: 'TIR',
    baseUrl: options.baseUrl ?? TIR_API_BASE_URL,
    forbiddenSuggestion: TIR_FORBIDDEN_SUGGESTION,
    projectContext: TIR_PROJECT_CONTEXT
  });
}

// Builds a tir command for hints and errors, for example
// formatTirCommand('project list') gives "e2ectl tir project list".
export function formatTirCommand(argumentsText: string): string {
  return formatCliCommand(`${TIR_COMMAND} ${argumentsText}`);
}
