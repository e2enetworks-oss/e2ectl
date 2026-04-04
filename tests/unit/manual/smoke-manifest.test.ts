import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  createSmokeManifest,
  loadSmokeManifest,
  updateSmokeManifest
} from '../../manual/helpers/smoke-manifest.js';

describe('smoke manifest helper', () => {
  it('creates, loads, and updates the shared smoke manifest shape', async () => {
    const tempDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'e2ectl-smoke-manifest-')
    );
    const manifestPath = path.join(tempDirectory, 'manual-smoke.json');

    const { manifest } = await createSmokeManifest({
      dnsDomain: 'release.example.com',
      manifestPath,
      prefix: 'release-smoke',
      tempRulesFilePath: '/tmp/release-smoke-rules.json'
    });

    expect(manifest.addon_reserved_ip).toBeNull();
    expect(manifest.dns_domain).toBe('release.example.com');
    expect(manifest.security_group_id).toBeNull();
    expect(manifest.ssh_key_deleted).toBe(false);
    expect(manifest.temp_rules_file_path).toBe('/tmp/release-smoke-rules.json');
    expect(manifest.volume_deleted).toBe(false);
    expect(manifest.vpc_deleted).toBe(false);

    const loadedManifest = await loadSmokeManifest(manifestPath);

    expect(loadedManifest).toEqual(manifest);

    await delay(5);

    const updatedManifest = await updateSmokeManifest(manifestPath, (draft) => {
      draft.volume_id = 25550;
      draft.vpc_id = 27835;
      draft.ssh_key_id = 1001;
    });

    expect(updatedManifest.volume_id).toBe(25550);
    expect(updatedManifest.vpc_id).toBe(27835);
    expect(updatedManifest.ssh_key_id).toBe(1001);
    expect(updatedManifest.updated_at).not.toBe(manifest.updated_at);

    const reloadedManifest = await loadSmokeManifest(manifestPath);

    expect(reloadedManifest.volume_id).toBe(25550);
    expect(reloadedManifest.vpc_id).toBe(27835);
    expect(reloadedManifest.ssh_key_id).toBe(1001);
  });
});
