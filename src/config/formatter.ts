import { formatCliCommand } from '../app/metadata.js';
import { buildTable } from '../core/table.js';

import { stableStringify, type JsonValue } from '../core/json.js';
import { maskSecret } from '../core/mask.js';
import type {
  ConfigCommandResult,
  ConfigImportedCommandResult
} from './service.js';
import type { ConfigFile, ProfileSummary, TirContext } from './types.js';

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
      myaccount: profile.myaccount ?? null,
      tir: profile.tir ?? null
    }));
}

export function formatProfilesTable(profiles: ProfileSummary[]): string {
  const table = buildTable({
    head: [
      'Alias',
      'Default',
      'API Key',
      'Auth Token',
      'MyAccount Context',
      'TIR Context'
    ]
  });

  for (const profile of profiles) {
    table.push([
      profile.alias,
      profile.isDefault ? 'yes' : '',
      profile.api_key,
      profile.auth_token,
      formatContext(profile.myaccount),
      formatContext(profile.tir)
    ]);
  }

  return table.toString();
}

// "account 12, project 34, Delhi" for a saved MyAccount or TIR block.
function formatContext(context: TirContext | null): string {
  if (context === null) {
    return '';
  }

  return [
    context.account_id === undefined
      ? undefined
      : `account ${context.account_id}`,
    context.project_id === undefined
      ? undefined
      : `project ${context.project_id}`,
    context.location
  ]
    .filter((part) => part !== undefined)
    .join(', ');
}

function renderConfigHuman(result: ConfigCommandResult): string {
  switch (result.action) {
    case 'imported':
      return renderImportedHuman(result);
    case 'list': {
      const profiles = summarizeProfiles(result.config);
      return profiles.length === 0
        ? `No profiles saved. Run ${formatCliCommand('configure')} to save one.\n`
        : `${formatProfilesTable(profiles)}\n`;
    }
    case 'removed':
      return `Removed profile "${result.alias}".\n`;
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
        saved_default_location: result.importedDefaults.location ?? null,
        saved_default_project_id: result.importedDefaults.project_id ?? null,
        profiles: summarizeProfiles(result.config)
      });
    case 'list':
    case 'removed':
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

  if (result.importedDefaults.project_id !== undefined) {
    lines.push(
      `Saved MyAccount project ID "${result.importedDefaults.project_id}" for imported aliases.`
    );
  }

  if (result.importedDefaults.location !== undefined) {
    lines.push(
      `Saved MyAccount location "${result.importedDefaults.location}" for imported aliases.`
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
