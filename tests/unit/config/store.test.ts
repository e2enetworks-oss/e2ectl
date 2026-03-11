import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ConfigFile } from '../../../src/config/index.js';
import { ConfigStore, createEmptyConfig } from '../../../src/config/store.js';

describe('ConfigStore', () => {
  it('returns an empty config when the file does not exist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const store = new ConfigStore({
      configPath: path.join(root, '.e2e', 'config.json')
    });

    await expect(store.read()).resolves.toEqual(createEmptyConfig());
  });

  it('writes and sorts profile aliases deterministically', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('zeta', {
      api_key: ' api-zeta ',
      auth_token: ' auth-zeta ',
      default_project_id: '2',
      default_location: 'Delhi'
    });
    await store.upsertProfile('alpha', {
      api_key: ' api-alpha ',
      auth_token: ' auth-alpha ',
      default_project_id: '1',
      default_location: 'Chennai'
    });

    const content = await readFile(configPath, 'utf8');
    const parsedConfig = JSON.parse(content) as ConfigFile;

    expect(Object.keys(parsedConfig.profiles)).toEqual(['alpha', 'zeta']);
    expect(parsedConfig.profiles.alpha).toEqual({
      api_key: 'api-alpha',
      auth_token: 'auth-alpha',
      default_project_id: '1',
      default_location: 'Chennai'
    });
  });

  it('updates saved per-alias default context', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('prod', {
      api_key: 'api-prod',
      auth_token: 'auth-prod'
    });

    const nextConfig = await store.updateProfile('prod', {
      default_project_id: '46429',
      default_location: 'Delhi'
    });

    expect(nextConfig.profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '46429',
      default_location: 'Delhi'
    });
  });

  it('reassigns the default alias when the current default is removed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('prod', {
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '1',
      default_location: 'Delhi'
    });
    await store.upsertProfile('dev', {
      api_key: 'api-dev',
      auth_token: 'auth-dev',
      default_project_id: '2',
      default_location: 'Chennai'
    });
    await store.setDefault('prod');

    const nextConfig = await store.removeProfile('prod');

    expect(nextConfig.default).toBe('dev');
    expect(Object.keys(nextConfig.profiles)).toEqual(['dev']);
  });
});
