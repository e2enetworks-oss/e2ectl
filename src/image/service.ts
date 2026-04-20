import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { ImageClient } from './client.js';
import type { ImageOsChoice, ImageSummary } from './types.js';

export interface ImageContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface ImageImportOptions extends ImageContextOptions {
  name: string;
  os?: ImageOsChoice;
  url: string;
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
}

export interface ImageListCommandResult {
  action: 'list';
  items: ImageItem[];
}

export interface ImageGetCommandResult {
  action: 'get';
  item: ImageItem;
}

export interface ImageImportCommandResult {
  action: 'import';
  message: string;
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
  | ImageGetCommandResult
  | ImageImportCommandResult
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

  async getImage(
    imageId: string,
    options: ImageContextOptions
  ): Promise<ImageGetCommandResult> {
    const client = await this.createImageClient(options);
    const image = await client.getImage(imageId);

    return { action: 'get', item: summarizeImage(image) };
  }

  async importImage(
    options: ImageImportOptions
  ): Promise<ImageImportCommandResult> {
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const url = normalizeRequiredString(options.url, 'URL', '--url');
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createImageClient(credentials);
    const result = await client.importImage({
      image_name: name,
      location: credentials.location,
      ...(options.os === undefined ? {} : { os: options.os }),
      public_url: url
    });

    return { action: 'import', message: result.message };
  }

  async deleteImage(
    imageId: string,
    options: ImageDeleteOptions
  ): Promise<ImageDeleteCommandResult> {
    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive, 'image');
      const confirmed = await this.dependencies.confirm(
        `Delete image ${imageId}? This cannot be undone.`
      );

      if (!confirmed) {
        return { action: 'delete', cancelled: true, id: imageId };
      }
    }

    const client = await this.createImageClient(options);
    const result = await client.deleteImage(imageId);

    return {
      action: 'delete',
      cancelled: false,
      id: imageId,
      message: result.message
    };
  }

  async renameImage(
    imageId: string,
    options: ImageRenameOptions
  ): Promise<ImageRenameCommandResult> {
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createImageClient(options);
    const result = await client.renameImage(imageId, name);

    return { action: 'rename', id: imageId, message: result.message, name };
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
    image_name: image.image_name,
    image_size: image.image_size,
    image_state: image.image_state,
    is_windows: image.is_windows ?? false,
    node_plans_available: image.node_plans_available ?? false,
    os_distribution: image.os_distribution,
    project_name: image.project_name ?? null,
    running_vms: image.running_vms,
    scaler_group_count: image.scaler_group_count ?? 0
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
