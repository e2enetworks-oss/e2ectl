import { readFile } from 'node:fs/promises';

import { CliError, EXIT_CODES } from '../core/errors.js';

export interface ImportedProfileSecrets {
  api_key: string;
  auth_token: string;
}

export async function readImportedProfiles(
  filePath: string
): Promise<Record<string, ImportedProfileSecrets>> {
  try {
    const content = await readFile(filePath, 'utf8');
    return parseImportedProfiles(content);
  } catch (error: unknown) {
    if (error instanceof CliError) {
      throw error;
    }

    if (isFileNotFound(error)) {
      throw new CliError(`Import file "${filePath}" was not found.`, {
        code: 'IMPORT_FILE_NOT_FOUND',
        exitCode: EXIT_CODES.config,
        suggestion: 'Pass a readable JSON file path with --file.'
      });
    }

    throw new CliError(`Unable to read import file "${filePath}".`, {
      cause: error,
      code: 'IMPORT_FILE_READ_FAILED',
      exitCode: EXIT_CODES.config,
      suggestion: 'Verify the path and file permissions, then retry.'
    });
  }
}

export function parseImportedProfiles(
  content: string
): Record<string, ImportedProfileSecrets> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error: unknown) {
    throw new CliError('Import file must contain valid JSON.', {
      cause: error,
      code: 'INVALID_IMPORT_FILE_JSON',
      exitCode: EXIT_CODES.config,
      suggestion: 'Download the credential JSON again and retry the import.'
    });
  }

  if (!isRecord(parsed)) {
    throw new CliError('Import file must be a JSON object keyed by alias.', {
      code: 'INVALID_IMPORT_FILE_SHAPE',
      exitCode: EXIT_CODES.config,
      suggestion:
        'Expected a top-level object like {"prod": {"api_key": "...", "api_auth_token": "..."}}.'
    });
  }

  const importedProfiles: Record<string, ImportedProfileSecrets> = {};

  for (const [rawAlias, rawProfile] of Object.entries(parsed)) {
    const alias = rawAlias.trim();
    if (alias.length === 0) {
      throw new CliError('Import file contains an empty alias key.', {
        code: 'INVALID_IMPORT_ALIAS',
        exitCode: EXIT_CODES.config,
        suggestion: 'Rename the alias keys in the JSON file and retry.'
      });
    }

    if (!isRecord(rawProfile)) {
      throw new CliError(`Alias "${alias}" must map to a JSON object.`, {
        code: 'INVALID_IMPORT_PROFILE',
        exitCode: EXIT_CODES.config,
        suggestion: 'Each alias must include api_key and api_auth_token fields.'
      });
    }

    const apiKey = requireNonEmptyString(rawProfile.api_key, alias, 'api_key');
    const authToken = requireAuthToken(rawProfile, alias);

    if (importedProfiles[alias] !== undefined) {
      throw new CliError(`Import file contains duplicate alias "${alias}".`, {
        code: 'DUPLICATE_IMPORT_ALIAS',
        exitCode: EXIT_CODES.config,
        suggestion: 'Ensure each alias appears only once in the JSON file.'
      });
    }

    importedProfiles[alias] = {
      api_key: apiKey,
      auth_token: authToken
    };
  }

  if (Object.keys(importedProfiles).length === 0) {
    throw new CliError('Import file does not contain any aliases.', {
      code: 'EMPTY_IMPORT_FILE',
      exitCode: EXIT_CODES.config,
      suggestion: 'Choose a file that includes at least one saved credential.'
    });
  }

  return importedProfiles;
}

function requireAuthToken(
  profile: Record<string, unknown>,
  alias: string
): string {
  const apiAuthToken = profile.api_auth_token;
  if (typeof apiAuthToken === 'string' && apiAuthToken.trim().length > 0) {
    return apiAuthToken.trim();
  }

  throw new CliError(
    `Alias "${alias}" is missing api_auth_token in the import file.`,
    {
      code: 'INVALID_IMPORT_AUTH_TOKEN',
      exitCode: EXIT_CODES.config,
      suggestion: 'Each alias must include a non-empty api_auth_token field.'
    }
  );
}

function requireNonEmptyString(
  value: unknown,
  alias: string,
  fieldName: string
): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  throw new CliError(
    `Alias "${alias}" is missing ${fieldName} in the import file.`,
    {
      code: 'INVALID_IMPORT_FIELD',
      exitCode: EXIT_CODES.config,
      suggestion: `Each alias must include a non-empty ${fieldName} field.`
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
