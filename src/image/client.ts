import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import {
  IMAGE_ACTION_RENAME,
  type ImageActionRequest,
  type ImageActionResult,
  type ImageSummary
} from './types.js';

const IMAGES_SAVED_PATH = '/images/saved-images/';

export interface ImageDeleteResult {
  message: string;
}

export interface ImageClient {
  deleteImage(imageId: string): Promise<ImageDeleteResult>;
  listImages(): Promise<ImageSummary[]>;
  renameImage(imageId: string, name: string): Promise<ImageActionResult>;
}

export class ImageApiClient implements ImageClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async deleteImage(imageId: string): Promise<ImageDeleteResult> {
    const response = await this.transport.delete<
      ApiEnvelope<ImageActionResult>
    >(buildImagePath(imageId));

    return { message: response.message };
  }

  async listImages(): Promise<ImageSummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<ImageSummary[]>>(IMAGES_SAVED_PATH);

    return response.data;
  }

  async renameImage(imageId: string, name: string): Promise<ImageActionResult> {
    const body: ImageActionRequest = {
      action_type: IMAGE_ACTION_RENAME,
      name
    };
    const response = await this.transport.request<
      ApiEnvelope<ImageActionResult>
    >({
      body,
      method: 'PUT',
      path: buildImagePath(imageId)
    });

    return response.data;
  }
}

function buildImagePath(imageId: string): string {
  return `/images/${imageId}/`;
}
