import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface SmokeManifestDnsRecord {
  current_value: string;
  deleted: boolean;
  domain_name: string;
  name: string;
  type: string;
}

export interface SmokeManifest {
  addon_reserved_ip: string | null;
  addon_reserved_ip_attached_node_id: number | null;
  addon_reserved_ip_deleted: boolean;
  created_at: string;
  dns_domain: string;
  dns_records: SmokeManifestDnsRecord[];
  node_deleted: boolean;
  node_id: number | null;
  prefix: string;
  preserved_reserved_ip: string | null;
  preserved_reserved_ip_deleted: boolean;
  security_group_attached_node_id: number | null;
  security_group_deleted: boolean;
  security_group_id: number | null;
  temp_rules_file_path: string | null;
  updated_at: string;
  version: 1;
}

export async function createSmokeManifest(options: {
  dnsDomain: string;
  manifestPath?: string;
  prefix: string;
  tempRulesFilePath?: string;
}): Promise<{
  manifest: SmokeManifest;
  path: string;
}> {
  const manifestPath = await resolveSmokeManifestPath(
    options.manifestPath,
    options.prefix
  );
  const timestamp = new Date().toISOString();
  const manifest: SmokeManifest = {
    addon_reserved_ip: null,
    addon_reserved_ip_attached_node_id: null,
    addon_reserved_ip_deleted: false,
    created_at: timestamp,
    dns_domain: options.dnsDomain,
    dns_records: [],
    node_deleted: false,
    node_id: null,
    prefix: options.prefix,
    preserved_reserved_ip: null,
    preserved_reserved_ip_deleted: false,
    security_group_attached_node_id: null,
    security_group_deleted: false,
    security_group_id: null,
    temp_rules_file_path: options.tempRulesFilePath ?? null,
    updated_at: timestamp,
    version: 1
  };

  await writeSmokeManifest(manifestPath, manifest);

  return {
    manifest,
    path: manifestPath
  };
}

export async function loadSmokeManifest(
  manifestPath: string
): Promise<SmokeManifest> {
  const contents = await readFile(path.resolve(manifestPath), 'utf8');
  return JSON.parse(contents) as SmokeManifest;
}

export async function updateSmokeManifest(
  manifestPath: string,
  mutate: (manifest: SmokeManifest) => void
): Promise<SmokeManifest> {
  const resolvedPath = path.resolve(manifestPath);
  const manifest = await loadSmokeManifest(resolvedPath);

  mutate(manifest);
  manifest.updated_at = new Date().toISOString();

  await writeSmokeManifest(resolvedPath, manifest);

  return manifest;
}

async function resolveSmokeManifestPath(
  manifestPath: string | undefined,
  prefix: string
): Promise<string> {
  const resolvedPath =
    manifestPath === undefined
      ? path.resolve(
          process.cwd(),
          '.tmp',
          `${prefix}-${Date.now().toString(36)}-manifest.json`
        )
      : path.resolve(manifestPath);

  await mkdir(path.dirname(resolvedPath), {
    recursive: true
  });

  return resolvedPath;
}

async function writeSmokeManifest(
  manifestPath: string,
  manifest: SmokeManifest
): Promise<void> {
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}
