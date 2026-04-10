import { createRequire } from 'node:module';

interface PackageMetadata {
  bin?: Record<string, string> | string;
  name: string;
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as PackageMetadata;

function resolveCliCommandName(metadata: PackageMetadata): string {
  if (typeof metadata.bin === 'string') {
    return metadata.name;
  }

  if (metadata.bin !== undefined) {
    const [commandName] = Object.keys(metadata.bin);

    if (commandName !== undefined) {
      return commandName;
    }
  }

  return metadata.name;
}

export const CLI_COMMAND_NAME = resolveCliCommandName(packageMetadata);
export const CLI_VERSION = packageMetadata.version;

export function formatCliCommand(argumentsText: string): string {
  return `${CLI_COMMAND_NAME} ${argumentsText}`;
}
