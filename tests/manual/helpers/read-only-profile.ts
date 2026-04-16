import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome, type TempHome } from '../../helpers/temp-home.js';
import {
  toConfigBackedReadOnlyCliEnv,
  type ReadOnlyEnv
} from './read-only-env.js';

export async function createConfigBackedReadOnlyHome(
  readOnlyEnv: ReadOnlyEnv
): Promise<TempHome> {
  const tempHome = await createTempHome();
  const importFilePath = await tempHome.writeImportFile(
    'manual-read-only-import.json',
    {
      [readOnlyEnv.configProfile.alias]: {
        api_auth_token: readOnlyEnv.configProfile.authToken,
        api_key: readOnlyEnv.configProfile.apiKey
      }
    }
  );
  const result = await runBuiltCli(
    [
      'config',
      'import',
      '--file',
      importFilePath,
      '--default',
      readOnlyEnv.configProfile.alias,
      '--default-project-id',
      readOnlyEnv.configProfile.defaultProjectId,
      '--default-location',
      readOnlyEnv.configProfile.defaultLocation,
      '--no-input'
    ],
    {
      env: toConfigBackedReadOnlyCliEnv(readOnlyEnv, tempHome.path)
    }
  );

  if (result.exitCode !== 0) {
    throw new Error(
      [
        'Failed to seed a config-backed manual read-only profile.',
        result.stderr.trim().length === 0
          ? 'STDERR: <empty>'
          : `STDERR: ${result.stderr.trim()}`,
        result.stdout.trim().length === 0
          ? 'STDOUT: <empty>'
          : `STDOUT: ${result.stdout.trim()}`
      ].join('\n')
    );
  }

  return tempHome;
}
