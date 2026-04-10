import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ConfigStore, type ConfigFile } from '../../src/config/index.js';

export interface TempHome {
  cleanup(): Promise<void>;
  configDirectoryPath: string;
  configPath: string;
  path: string;
  readConfig(): Promise<ConfigFile>;
  writeConfig(config: ConfigFile): Promise<void>;
  writeImportFile(
    fileName: string,
    value: Record<string, unknown> | string
  ): Promise<string>;
}

export async function createTempHome(): Promise<TempHome> {
  const homePath = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-home-'));
  const configDirectoryPath = path.join(homePath, '.e2e');
  const configPath = path.join(configDirectoryPath, 'config.json');
  const store = new ConfigStore({ configPath });

  return {
    async cleanup(): Promise<void> {
      await rm(homePath, { force: true, recursive: true });
    },
    configDirectoryPath,
    configPath,
    path: homePath,
    readConfig: () => store.read(),
    writeConfig: (config) => store.write(config),
    async writeImportFile(fileName, value): Promise<string> {
      const importFilePath = path.join(homePath, fileName);
      const payload =
        typeof value === 'string' ? value : JSON.stringify(value, null, 2);

      await mkdir(path.dirname(importFilePath), { recursive: true });
      await writeFile(importFilePath, `${payload}\n`, 'utf8');

      return importFilePath;
    }
  };
}

export async function readFileMode(filePath: string): Promise<number> {
  const { mode } = await stat(filePath);
  return mode & 0o777;
}

export async function readJsonFile<TValue>(filePath: string): Promise<TValue> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as TValue;
}
