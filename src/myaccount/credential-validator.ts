import type { ProfileConfig } from '../config/index.js';
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

    await transport.get<ApiEnvelope<unknown>>('/iam/multi-crn/', {
      includeProjectContext: false
    });

    return {
      valid: true,
      message: 'Credentials validated successfully against /iam/multi-crn/.'
    };
  }
}
