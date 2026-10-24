import { AppError, EXIT_CODES } from '../core/errors.js';
import type {
  ApiAuthCredentials,
  ApiClientCredentials,
  ApiEnvelope,
  ApiTransport
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

// Builds the transport the token is checked with. The runtime passes the
// MyAccount one, so the check always uses the same address and settings as
// the MyAccount commands.
export type CreateValidationTransport = (
  credentials: ApiClientCredentials
) => ApiTransport;

export class ApiCredentialValidator implements CredentialValidator {
  constructor(private readonly createTransport: CreateValidationTransport) {}

  async validate(
    credentials: ApiAuthCredentials
  ): Promise<CredentialValidationResult> {
    // One token works on MyAccount and TIR, so checking it against MyAccount
    // is enough for every platform.
    const transport = this.createTransport(credentials);

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
