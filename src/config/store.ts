import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CliError, EXIT_CODES } from '../core/errors.js';
import { isNonEmptyString } from '../core/guards.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type { ConfigFile, ProfileConfig } from './types.js';

const DEFAULT_DIRECTORY_NAME = '.e2e';
const DEFAULT_CONFIG_FILE_NAME = 'config.json';
const CONFIG_DIRECTORY_MODE = 0o700;
const CONFIG_FILE_MODE = 0o600;

export interface ConfigStoreOptions {
  configPath?: string;
}

export class ConfigStore {
  readonly configPath: string;

  constructor(options: ConfigStoreOptions = {}) {
    this.configPath =
      options.configPath ??
      path.join(os.homedir(), DEFAULT_DIRECTORY_NAME, DEFAULT_CONFIG_FILE_NAME);
  }

  async read(): Promise<ConfigFile> {
    try {
      await assertSecureConfigFilePermissions(this.configPath);
      const content = await readFile(this.configPath, 'utf8');
      return parseStoredConfig(content, this.configPath);
    } catch (error: unknown) {
      if (isFileNotFound(error)) {
        return createEmptyConfig();
      }

      throw error;
    }
  }

  async write(config: ConfigFile): Promise<void> {
    const normalizedConfig = normalizeConfig(config);
    const directoryPath = path.dirname(this.configPath);
    await ensureSecureDirectory(directoryPath);
    const payload = stableStringify(normalizedConfig as unknown as JsonValue);
    await writeSecureConfigFile(this.configPath, `${payload}\n`);
  }

  async upsertProfile(
    alias: string,
    profile: ProfileConfig
  ): Promise<ConfigFile> {
    const config = await this.read();
    const nextConfig: ConfigFile = {
      ...config,
      profiles: {
        ...config.profiles,
        [alias]: profile
      },
      default: config.default ?? alias
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async removeProfile(alias: string): Promise<ConfigFile> {
    const config = await this.read();
    const nextProfiles = Object.fromEntries(
      Object.entries(config.profiles).filter(
        ([profileAlias]) => profileAlias !== alias
      )
    );

    const nextDefault =
      config.default === alias
        ? firstProfileAlias(nextProfiles)
        : config.default;
    const nextConfig =
      nextDefault === undefined
        ? {
            profiles: nextProfiles
          }
        : {
            profiles: nextProfiles,
            default: nextDefault
          };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async setDefault(alias: string): Promise<ConfigFile> {
    const config = await this.read();
    const nextConfig: ConfigFile = {
      ...config,
      default: alias
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async updateProfile(
    alias: string,
    patch: Partial<ProfileConfig>
  ): Promise<ConfigFile> {
    const config = await this.read();
    const currentProfile = config.profiles[alias];
    const nextConfig: ConfigFile = {
      ...config,
      profiles: {
        ...config.profiles,
        [alias]: normalizeProfile({
          ...currentProfile,
          ...patch
        } as ProfileConfig)
      }
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async hasProfile(alias: string): Promise<boolean> {
    const config = await this.read();
    return config.profiles[alias] !== undefined;
  }
}

export function createEmptyConfig(): ConfigFile {
  return {
    profiles: {}
  };
}

export function normalizeConfig(config: ConfigFile): ConfigFile {
  const sortedProfiles = Object.fromEntries(
    Object.entries(config.profiles)
      .map(([alias, profile]) => [alias, normalizeProfile(profile)] as const)
      .sort(([leftAlias], [rightAlias]) => leftAlias.localeCompare(rightAlias))
  );

  return config.default === undefined
    ? {
        profiles: sortedProfiles
      }
    : {
        profiles: sortedProfiles,
        default: config.default
      };
}

function parseStoredConfig(content: string, configPath: string): ConfigFile {
  const displayPath = formatConfigPathForDisplay(configPath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error: unknown) {
    throw new CliError(
      `Configuration file "${displayPath}" contains invalid JSON.`,
      {
        cause: error,
        code: 'CONFIG_PARSE_ERROR',
        details: [`Path: ${displayPath}`],
        exitCode: EXIT_CODES.config,
        suggestion:
          'Repair or replace the config file with valid JSON, then retry.'
      }
    );
  }

  return normalizeConfig(validateConfigShape(parsed, configPath));
}

function normalizeProfile(profile: ProfileConfig): ProfileConfig {
  const normalizedProfile: ProfileConfig = {
    api_key: profile.api_key.trim(),
    auth_token: profile.auth_token.trim()
  };

  if (isNonEmptyString(profile.default_project_id)) {
    normalizedProfile.default_project_id = profile.default_project_id.trim();
  }

  if (isNonEmptyString(profile.default_location)) {
    normalizedProfile.default_location = profile.default_location.trim();
  }

  return normalizedProfile;
}

function firstProfileAlias(
  profiles: Record<string, ProfileConfig>
): string | undefined {
  return Object.keys(profiles).sort()[0];
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function assertSecureConfigFilePermissions(
  configPath: string
): Promise<void> {
  if (process.platform === 'win32') {
    return;
  }

  const fileStats = await stat(configPath);
  const fileMode = fileStats.mode & 0o777;

  if ((fileMode & 0o077) === 0) {
    return;
  }

  const displayPath = formatConfigPathForDisplay(configPath);
  throw new CliError(
    `Configuration file "${displayPath}" has insecure permissions.`,
    {
      code: 'CONFIG_INSECURE_PERMISSIONS',
      details: [
        `Path: ${displayPath}`,
        `Mode: ${formatMode(fileMode)}`,
        'Required: 0600 or stricter on POSIX systems.'
      ],
      exitCode: EXIT_CODES.config,
      suggestion: `Run \`chmod 600 ${displayPath}\` and retry.`
    }
  );
}

async function ensureSecureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, {
    recursive: true,
    mode: CONFIG_DIRECTORY_MODE
  });
  await chmod(directoryPath, CONFIG_DIRECTORY_MODE);
}

async function writeSecureConfigFile(
  configPath: string,
  payload: string
): Promise<void> {
  const tempPath = path.join(
    path.dirname(configPath),
    `.${path.basename(configPath)}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(tempPath, payload, {
      encoding: 'utf8',
      flag: 'wx',
      mode: CONFIG_FILE_MODE
    });
    // chmod before rename: rename(2) preserves file mode on POSIX, so this
    // single chmod is sufficient. A second chmod after rename would create a
    // TOCTOU window and would leave the file stranded if it threw on NFS.
    await chmod(tempPath, CONFIG_FILE_MODE);
    await rename(tempPath, configPath);
  } finally {
    // Force-remove the temp file in case writeFile or chmod failed before
    // rename. After a successful rename tempPath no longer exists, so this
    // is a safe no-op (force: true suppresses ENOENT).
    await rm(tempPath, { force: true });
  }
}

function validateConfigShape(value: unknown, configPath: string): ConfigFile {
  if (!isObjectRecord(value)) {
    throw invalidConfigShapeError(
      configPath,
      'Top-level config must be an object.'
    );
  }

  if (!isObjectRecord(value.profiles)) {
    throw invalidConfigShapeError(
      configPath,
      '"profiles" must be an object keyed by alias.'
    );
  }

  if (value.default !== undefined && typeof value.default !== 'string') {
    throw invalidConfigShapeError(
      configPath,
      '"default" must be a string when present.'
    );
  }

  const profiles: Record<string, ProfileConfig> = {};
  for (const [alias, rawProfile] of Object.entries(value.profiles)) {
    profiles[alias] = validateProfileShape(alias, rawProfile, configPath);
  }

  return value.default === undefined
    ? {
        profiles
      }
    : {
        profiles,
        default: value.default
      };
}

function validateProfileShape(
  alias: string,
  value: unknown,
  configPath: string
): ProfileConfig {
  if (!isObjectRecord(value)) {
    throw invalidConfigShapeError(
      configPath,
      `Profile "${alias}" must be an object.`
    );
  }

  const apiKey = readRequiredProfileField(
    alias,
    'api_key',
    value.api_key,
    configPath
  );
  const authToken = readRequiredProfileField(
    alias,
    'auth_token',
    value.auth_token,
    configPath
  );
  const profile: ProfileConfig = {
    api_key: apiKey,
    auth_token: authToken
  };

  if (value.default_project_id !== undefined) {
    profile.default_project_id = readOptionalProfileField(
      alias,
      'default_project_id',
      value.default_project_id,
      configPath
    );
  }

  if (value.default_location !== undefined) {
    profile.default_location = readOptionalProfileField(
      alias,
      'default_location',
      value.default_location,
      configPath
    );
  }

  return profile;
}

function readRequiredProfileField(
  alias: string,
  field: 'api_key' | 'auth_token',
  value: unknown,
  configPath: string
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidConfigShapeError(
      configPath,
      `Profile "${alias}" field "${field}" must be a non-empty string.`
    );
  }

  return value.trim();
}

function readOptionalProfileField(
  alias: string,
  field: 'default_project_id' | 'default_location',
  value: unknown,
  configPath: string
): string {
  if (typeof value !== 'string') {
    throw invalidConfigShapeError(
      configPath,
      `Profile "${alias}" field "${field}" must be a string when present.`
    );
  }

  return value.trim();
}

function invalidConfigShapeError(configPath: string, reason: string): CliError {
  const displayPath = formatConfigPathForDisplay(configPath);
  return new CliError(
    `Configuration file "${displayPath}" is not a valid e2ectl config.`,
    {
      code: 'CONFIG_INVALID_SHAPE',
      details: [`Path: ${displayPath}`, `Problem: ${reason}`],
      exitCode: EXIT_CODES.config,
      suggestion:
        'Restore a valid config file or re-import your credentials, then retry.'
    }
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatConfigPathForDisplay(configPath: string): string {
  const homePath = os.homedir();
  const relativeToHome = path.relative(homePath, configPath);

  if (relativeToHome === '') {
    return '~';
  }

  if (!relativeToHome.startsWith('..') && !path.isAbsolute(relativeToHome)) {
    return `~/${relativeToHome}`;
  }

  return configPath;
}

function formatMode(mode: number): string {
  return `0${mode.toString(8).padStart(3, '0')}`;
}
