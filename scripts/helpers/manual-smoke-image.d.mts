export interface SavedImageTransport {
  request(options: {
    body: {
      action_type: 'delete_image';
    };
    method: 'PUT';
    path: string;
  }): Promise<unknown>;
}

export function deleteSavedImage(
  transport: SavedImageTransport,
  imageId: string
): Promise<void>;
