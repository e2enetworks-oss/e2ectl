import { mkdtemp, rm } from 'node:fs/promises';
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
      manifestPath,
      prefix: 'release-smoke',
      tempRulesFilePath: '/tmp/release-smoke-rules.json'
    });

    expect(manifest.addon_reserved_ip).toBeNull();
    expect(manifest.saved_image_deleted).toBe(false);
    expect(manifest.saved_image_id).toBeNull();
    expect(manifest.security_group_id).toBeNull();
    expect(manifest.ssh_key_attached_node_id).toBeNull();
    expect(manifest.ssh_key_deleted).toBe(false);
    expect(manifest.temp_rules_file_path).toBe('/tmp/release-smoke-rules.json');
    expect(manifest.volume_attached_node_id).toBeNull();
    expect(manifest.volume_deleted).toBe(false);
    expect(manifest.vpc_attached_node_id).toBeNull();
    expect(manifest.vpc_deleted).toBe(false);

    const loadedManifest = await loadSmokeManifest(manifestPath);

    expect(loadedManifest).toEqual(manifest);

    await delay(5);

    const updatedManifest = await updateSmokeManifest(manifestPath, (draft) => {
      draft.saved_image_id = 'img-455';
      draft.ssh_key_attached_node_id = 100157;
      draft.volume_attached_node_id = 100157;
      draft.volume_id = 25550;
      draft.vpc_attached_node_id = 100157;
      draft.vpc_id = 27835;
      draft.ssh_key_id = 1001;
    });

    expect(updatedManifest.saved_image_id).toBe('img-455');
    expect(updatedManifest.ssh_key_attached_node_id).toBe(100157);
    expect(updatedManifest.volume_attached_node_id).toBe(100157);
    expect(updatedManifest.volume_id).toBe(25550);
    expect(updatedManifest.vpc_attached_node_id).toBe(100157);
    expect(updatedManifest.vpc_id).toBe(27835);
    expect(updatedManifest.ssh_key_id).toBe(1001);
    expect(updatedManifest.updated_at).not.toBe(manifest.updated_at);

    const reloadedManifest = await loadSmokeManifest(manifestPath);

    expect(reloadedManifest.saved_image_id).toBe('img-455');
    expect(reloadedManifest.ssh_key_attached_node_id).toBe(100157);
    expect(reloadedManifest.volume_attached_node_id).toBe(100157);
    expect(reloadedManifest.volume_id).toBe(25550);
    expect(reloadedManifest.vpc_attached_node_id).toBe(100157);
    expect(reloadedManifest.vpc_id).toBe(27835);
    expect(reloadedManifest.ssh_key_id).toBe(1001);
  });

  it('stores default smoke manifests outside .tmp so make build cleanup does not erase them', async () => {
    const originalCwd = process.cwd();
    const tempDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'e2ectl-smoke-manifest-cwd-')
    );

    try {
      process.chdir(tempDirectory);

      const { path: manifestPath } = await createSmokeManifest({
        prefix: 'release-smoke'
      });

      expect(path.basename(path.dirname(manifestPath))).toBe('.manual-smoke');
      expect(path.basename(manifestPath)).toMatch(
        /^release-smoke-[a-z0-9]+-manifest\.json$/
      );
      expect(manifestPath).not.toContain(`${path.sep}.tmp${path.sep}`);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDirectory, {
        force: true,
        recursive: true
      });
    }
  });
});
