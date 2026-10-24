export interface TirImageApiVersion {
  app?: { display_name?: string; name?: string };
  description?: string;
  image_version_id: number;
  is_internal?: boolean;
  version: string;
}

export interface TirImageApiItem {
  image_id: number;
  name: string;
  versions?: TirImageApiVersion[];
}

// One row per image version: the version id is what instance create takes.
export interface TirImageItem {
  app: string;
  description: string;
  image_id: number;
  image_name: string;
  version: string;
  version_id: number;
}

export interface TirImageContextOptions {
  accountId?: string;
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface TirImageListCommandResult {
  action: 'list';
  items: TirImageItem[];
}

export type TirImageCommandResult = TirImageListCommandResult;
