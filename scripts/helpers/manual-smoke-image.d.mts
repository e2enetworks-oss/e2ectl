export interface SavedImageTransport {
  delete(path: string): Promise<unknown>;
}

export function deleteSavedImage(
  transport: SavedImageTransport,
  imageId: string
): Promise<void>;
