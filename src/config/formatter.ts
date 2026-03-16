import Table from 'cli-table3';

import { stableStringify, type JsonValue } from '../core/json.js';
import { maskSecret } from '../core/mask.js';
import type {
  ConfigCommandResult,
  ConfigImportedCommandResult
} from './service.js';
import type { ConfigFile, ProfileSummary } from './types.js';

export function renderConfigResult(
  result: ConfigCommandResult,
  json: boolean
): string {
  return json ? renderConfigJson(result) : renderConfigHuman(result);
}

export function summarizeProfiles(config: ConfigFile): ProfileSummary[] {
  return Object.entries(config.profiles)
    .sort(([leftAlias], [rightAlias]) => leftAlias.localeCompare(rightAlias))
    .map(([alias, profile]) => ({
      alias,
      isDefault: config.default === alias,
      api_key: maskSecret(profile.api_key),
      auth_token: maskSecret(profile.auth_token),
      default_project_id: profile.default_project_id ?? '',
      default_location: profile.default_location ?? ''
    }));
}

export function formatProfilesTable(profiles: ProfileSummary[]): string {
  const table = new Table({
    head: [
      'Alias',
      'Default',
      'API Key',
      'Auth Token',
      'Default Project ID',
      'Default Location'
    ]
  });

  for (const profile of profiles) {
    table.push([
      profile.alias,
      profile.isDefault ? 'yes' : '',
      profile.api_key,
      profile.auth_token,
      profile.default_project_id,
      profile.default_location
    ]);
  }

  return table.toString();
}

function renderConfigHuman(result: ConfigCommandResult): string {
  switch (result.action) {
    case 'imported':
      return renderImportedHuman(result);
    case 'list': {
      const profiles = summarizeProfiles(result.config);
      return profiles.length === 0
        ? 'No profiles saved.\n'
        : `${formatProfilesTable(profiles)}\n`;
    }
    case 'removed':
      return `Removed profile "${result.alias}".\n`;
    case 'set-context':
      return `Updated default context for "${result.alias}".\n`;
    case 'set-default':
      return `Set "${result.alias}" as the default profile.\n`;
  }
}

function renderConfigJson(result: ConfigCommandResult): string {
  switch (result.action) {
    case 'imported':
      return renderJson({
        action: 'imported',
        default: result.config.default ?? null,
        imported_aliases: result.importedAliases,
        imported_count: result.importedAliases.length,
        saved_default_location:
          result.importedDefaults.default_location ?? null,
        saved_default_project_id:
          result.importedDefaults.default_project_id ?? null,
        profiles: summarizeProfiles(result.config)
      });
    case 'list':
    case 'removed':
    case 'set-context':
    case 'set-default':
      return renderJson({
        action: result.action,
        default: result.config.default ?? null,
        profiles: summarizeProfiles(result.config)
      });
  }
}

function renderImportedHuman(result: ConfigImportedCommandResult): string {
  const lines = [
    formatImportSuccessMessage(result.filePath, result.importedAliases),
    formatImportDefaultMessage(result)
  ];

  if (result.importedDefaults.default_project_id !== undefined) {
    lines.push(
      `Saved default project ID "${result.importedDefaults.default_project_id}" for imported aliases.`
    );
  }

  if (result.importedDefaults.default_location !== undefined) {
    lines.push(
      `Saved default location "${result.importedDefaults.default_location}" for imported aliases.`
    );
  }

  return `${lines.join('\n')}\n`;
}

function formatImportDefaultMessage(
  result: ConfigImportedCommandResult
): string {
  if (
    result.config.default !== undefined &&
    result.config.default !== result.previousDefault
  ) {
    return `Set "${result.config.default}" as the default profile.`;
  }

  if (result.config.default !== undefined) {
    return `Default profile remains "${result.config.default}".`;
  }

  return 'No default profile was set.';
}

function formatImportSuccessMessage(
  filePath: string,
  aliases: string[]
): string {
  const noun = aliases.length === 1 ? 'profile' : 'profiles';
  return `Imported ${aliases.length} ${noun} from "${filePath}".\nSaved aliases: ${aliases.join(', ')}.`;
}

function renderJson(value: unknown): string {
  return `${stableStringify(value as JsonValue)}\n`;
}
