import type { ProfileConfig } from '../config/index.js';
import { MyAccountApiClient, type FetchLike } from './client.js';

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
    const client = new MyAccountApiClient(
      {
        ...profile,
        source: 'profile'
      },
      this.options
    );

    await client.validateCredentials();

    return {
      valid: true,
      message: 'Credentials validated successfully against /iam/multi-crn/.'
    };
  }
}
