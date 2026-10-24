export {
  ApiCredentialValidator,
  type CreateValidationTransport,
  type CredentialValidationResult,
  type CredentialValidator
} from './credential-validator.js';
export { buildConfigCommand, formatConfigCommand } from './command.js';
export {
  resolveAccountCredentials,
  resolveCredentials,
  resolveStoredAccountCredentials,
  resolveStoredCredentials,
  resolveStoredTirCredentials,
  resolveTirCredentials,
  type TirRequirement
} from './resolver.js';
export { ConfigStore, createEmptyConfig, normalizeConfig } from './store.js';
export type {
  AuthField,
  ConfigFile,
  ContextField,
  ProfileConfig,
  ResolvedAccountCredentials,
  ProfileSummary,
  ResolvedCredentials,
  ResolvedTirCredentials,
  TirContext,
  TirContextField
} from './types.js';
export type { CredentialResolutionStore } from './resolver.js';
export { VALID_LOCATIONS } from './types.js';
export {
  configurePlatform,
  describePlatformSetup,
  findSetupProfile,
  renderPlatformSetupResult,
  type PlatformConfigureCommandResult,
  type PlatformConfigureInput,
  type PlatformSetupResult,
  type PlatformSetupSteps,
  type SetupAccount,
  type SetupContext,
  type SetupIo,
  type SetupPlatform,
  type SetupProject,
  type SetupValues
} from './platform-setup.js';
