import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { ImageClient } from './client.js';
import type { ImageSummary } from './types.js';

export interface ImageContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface ImageDeleteOptions extends ImageContextOptions {
  force?: boolean;
}

export interface ImageRenameOptions extends ImageContextOptions {
  name: string;
}

export interface ImageItem {
  creation_time: string;
  image_id: string;
  image_name: string;
  image_size: string;
  image_state: string;
  is_windows: boolean;
  node_plans_available: boolean;
  os_distribution: string;
  project_name: string | null;
  running_vms: number;
  scaler_group_count: number;
  template_id: number | null;
}

export interface ImageListCommandResult {
  action: 'list';
  items: ImageItem[];
}

export interface ImageDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  id: string;
  message?: string;
}

export interface ImageRenameCommandResult {
  action: 'rename';
  id: string;
  message: string;
  name: string;
}

export type ImageCommandResult =
  | ImageDeleteCommandResult
  | ImageListCommandResult
  | ImageRenameCommandResult;

interface ImageStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface ImageServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createImageClient(credentials: ResolvedCredentials): ImageClient;
  isInteractive: boolean;
  store: ImageStore;
}

export class ImageService {
  constructor(private readonly dependencies: ImageServiceDependencies) {}

  async listImages(
    options: ImageContextOptions
  ): Promise<ImageListCommandResult> {
    const client = await this.createImageClient(options);

    return {
      action: 'list',
      items: (await client.listImages()).map(summarizeImage)
    };
  }

  async deleteImage(
    imageId: string,
    options: ImageDeleteOptions
  ): Promise<ImageDeleteCommandResult> {
    const normalizedImageId = normalizeImageId(imageId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive, 'image');
      const confirmed = await this.dependencies.confirm(
        `Delete image ${normalizedImageId}? This cannot be undone.`
      );

      if (!confirmed) {
        return { action: 'delete', cancelled: true, id: normalizedImageId };
      }
    }

    const client = await this.createImageClient(options);
    const result = await client.deleteImage(normalizedImageId);

    return {
      action: 'delete',
      cancelled: false,
      id: normalizedImageId,
      message: result.message
    };
  }

  async renameImage(
    imageId: string,
    options: ImageRenameOptions
  ): Promise<ImageRenameCommandResult> {
    const normalizedImageId = normalizeImageId(imageId);
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createImageClient(options);
    const result = await client.renameImage(normalizedImageId, name);

    return {
      action: 'rename',
      id: normalizedImageId,
      message: result.message,
      name
    };
  }

  private async createImageClient(
    options: ImageContextOptions
  ): Promise<ImageClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createImageClient(credentials);
  }
}

function summarizeImage(image: ImageSummary): ImageItem {
  return {
    creation_time: image.creation_time,
    image_id: image.image_id,
    image_name: image.image_name ?? image.name ?? '',
    image_size: image.image_size,
    image_state: image.image_state,
    is_windows: image.is_windows ?? false,
    node_plans_available: image.node_plans_available ?? false,
    os_distribution: image.os_distribution,
    project_name: image.project_name ?? null,
    running_vms: Number(image.running_vms),
    scaler_group_count: image.scaler_group_count ?? 0,
    template_id: image.template_id ?? null
  };
}

function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}

function normalizeImageId(imageId: string): string {
  const normalizedImageId = imageId.trim();
  if (normalizedImageId.length > 0) {
    return normalizedImageId;
  }

  throw new CliError('Image ID cannot be empty.', {
    code: 'EMPTY_IMAGE_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass the saved image id as the first argument.'
  });
}

function assertCanDelete(isInteractive: boolean, resourceName: string): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    `Deleting an ${resourceName} requires confirmation in an interactive terminal.`,
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}
