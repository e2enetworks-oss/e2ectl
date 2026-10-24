import {
  resolveStoredTirCredentials,
  type ConfigFile,
  type ResolvedTirCredentials
} from '../../config/index.js';
import type { TirImageClient } from './client.js';
import type {
  TirImageApiItem,
  TirImageContextOptions,
  TirImageItem,
  TirImageListCommandResult
} from './types.js';

interface TirImageStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface TirImageServiceDependencies {
  createTirImageClient(credentials: ResolvedTirCredentials): TirImageClient;
  store: TirImageStore;
}

export class TirImageService {
  constructor(private readonly dependencies: TirImageServiceDependencies) {}

  async list(
    options: TirImageContextOptions
  ): Promise<TirImageListCommandResult> {
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      options,
      'project'
    );
    const client = this.dependencies.createTirImageClient(credentials);

    return {
      action: 'list',
      items: (await client.listImages()).flatMap(toTirImageItems)
    };
  }
}

// Internal versions are never shown.
function toTirImageItems(image: TirImageApiItem): TirImageItem[] {
  return (image.versions ?? [])
    .filter((version) => version.is_internal !== true)
    .map((version) => ({
      app: version.app?.name ?? '',
      description: version.description ?? '',
      image_id: image.image_id,
      image_name: image.name,
      version: version.version,
      version_id: version.image_version_id
    }));
}
