import { AppError, EXIT_CODES } from '../core/errors.js';
import {
  HttpTransport,
  type ApiAuthCredentials,
  type ApiEnvelope,
  type FetchLike
} from '../http/index.js';

export interface CredentialValidationResult {
  message?: string;
  valid: boolean;
}

export interface CredentialValidator {
  validate(
    credentials: ApiAuthCredentials
  ): Promise<CredentialValidationResult>;
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

  async validate(
    credentials: ApiAuthCredentials
  ): Promise<CredentialValidationResult> {
    // One token works on MyAccount and TIR, so checking it against MyAccount
    // is enough for every platform.
    const transport = new HttpTransport(
      {
        ...credentials,
        source: 'profile'
      },
      { ...this.options, apiName: 'MyAccount' }
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

function isCredentialAuthFailure(error: unknown): error is AppError {
  return (
    error instanceof AppError &&
    error.exitCode === EXIT_CODES.auth &&
    error.code === 'API_REQUEST_FAILED'
  );
}
