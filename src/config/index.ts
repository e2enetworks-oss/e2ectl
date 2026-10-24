export {
  ApiCredentialValidator,
  type CreateValidationTransport,
  type CredentialValidationResult,
  type CredentialValidator
} from './credential-validator.js';
export { buildConfigCommand } from './command.js';
export {
  resolveAccountCredentials,
  resolveCredentials,
  resolveStoredAccountCredentials,
  resolveStoredCredentials,
  resolveStoredTirCredentials,
  resolveTirCredentials
} from './resolver.js';
export { pickValue, type ValueSources } from './value-order.js';
export {
  ConfigStore,
  createEmptyConfig,
  findProfile,
  normalizeConfig
} from './store.js';
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
export {
  CONTEXT_ENV_VAR_BY_FIELD,
  TIR_CONTEXT_ENV_VAR_BY_FIELD
} from './types.js';
export {
  configurePlatform,
  createSetupIo,
  describePlatformSetup,
  findSetupProfile,
  renderPlatformSetupResult,
  type PlatformConfigureCommandResult,
  type PlatformConfigureInput,
  type PlatformSetupResult,
  type PlatformSetupSteps,
  type SetupIo,
  type SetupPlatform,
  type SetupValues
} from './platform-setup.js';
