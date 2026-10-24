import type { TirContextOptions } from '../../app/context-options.js';
import {
  resolveStoredTirCredentials,
  type CredentialResolutionStore,
  type ResolvedTirCredentials
} from '../../config/index.js';
import type { TirImageClient } from './client.js';
import type {
  TirImageApiItem,
  TirImageItem,
  TirImageListCommandResult
} from './types.js';

export interface TirImageServiceDependencies {
  createTirImageClient(credentials: ResolvedTirCredentials): TirImageClient;
  store: CredentialResolutionStore;
}

export class TirImageService {
  constructor(private readonly dependencies: TirImageServiceDependencies) {}

  async list(options: TirContextOptions): Promise<TirImageListCommandResult> {
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
