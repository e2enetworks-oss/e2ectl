import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SMOKE_MANIFEST_DIRECTORY_NAME = '.manual-smoke';

export async function createSmokeManifest(options) {
  const manifestPath = await resolveSmokeManifestPath(
    options.manifestPath,
    options.prefix
  );
  const timestamp = new Date().toISOString();
  const manifest = {
    addon_reserved_ip: null,
    addon_reserved_ip_attached_node_id: null,
    addon_reserved_ip_deleted: false,
    created_at: timestamp,
    node_deleted: false,
    node_id: null,
    prefix: options.prefix,
    preserved_reserved_ip: null,
    preserved_reserved_ip_deleted: false,
    saved_image_deleted: false,
    saved_image_id: null,
    security_group_attached_node_id: null,
    security_group_deleted: false,
    security_group_id: null,
    ssh_key_attached_node_id: null,
    ssh_key_deleted: false,
    ssh_key_id: null,
    temp_rules_file_path: options.tempRulesFilePath ?? null,
    updated_at: timestamp,
    version: 1,
    volume_attached_node_id: null,
    volume_deleted: false,
    volume_id: null,
    vpc_attached_node_id: null,
    vpc_deleted: false,
    vpc_id: null
  };

  await writeSmokeManifest(manifestPath, manifest);

  return {
    manifest,
    path: manifestPath
  };
}

export async function loadSmokeManifest(manifestPath) {
  const contents = await readFile(path.resolve(manifestPath), 'utf8');
  return JSON.parse(contents);
}

export async function updateSmokeManifest(manifestPath, mutate) {
  const resolvedPath = path.resolve(manifestPath);
  const manifest = await loadSmokeManifest(resolvedPath);

  mutate(manifest);
  manifest.updated_at = new Date().toISOString();

  await writeSmokeManifest(resolvedPath, manifest);

  return manifest;
}

async function resolveSmokeManifestPath(manifestPath, prefix) {
  const resolvedPath =
    manifestPath === undefined
      ? path.resolve(
          process.cwd(),
          DEFAULT_SMOKE_MANIFEST_DIRECTORY_NAME,
          `${prefix}-${Date.now().toString(36)}-manifest.json`
        )
      : path.resolve(manifestPath);

  await mkdir(path.dirname(resolvedPath), {
    recursive: true
  });

  return resolvedPath;
}

async function writeSmokeManifest(manifestPath, manifest) {
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}
