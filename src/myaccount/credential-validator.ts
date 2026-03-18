import type { ProfileConfig } from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { MyAccountApiTransport } from './transport.js';
import type { ApiEnvelope, FetchLike } from './types.js';

export interface CredentialValidationResult {
  message?: string;
  valid: boolean;
}

export interface CredentialValidator {
  validate(profile: ProfileConfig): Promise<CredentialValidationResult>;
}

export interface ApiCredentialValidatorOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export class ApiCredentialValidator implements CredentialValidator {
  private readonly options: ApiCredentialValidatorOptions;

  constructor(options: ApiCredentialValidatorOptions = {}) {
    this.options = options;
  }

  async validate(profile: ProfileConfig): Promise<CredentialValidationResult> {
    const transport = new MyAccountApiTransport(
      {
        ...profile,
        source: 'profile'
      },
      this.options
    );

    try {
      await transport.get<ApiEnvelope<unknown>>('/iam/multi-crn/', {
        includeProjectContext: false
      });
    } catch (error: unknown) {
      if (isCredentialAuthFailure(error)) {
        return {
          valid: false,
          message: error.message
        };
      }

      throw error;
    }

    return {
      valid: true,
      message: 'Credentials validated successfully against /iam/multi-crn/.'
    };
  }
}

function isCredentialAuthFailure(error: unknown): error is CliError {
  return (
    error instanceof CliError &&
    error.exitCode === EXIT_CODES.auth &&
    error.code === 'API_REQUEST_FAILED'
  );
}
