export interface EosBucketApiItem {
  created_at?: string;
  name: string;
  status?: string;
  used_MB?: number | string | null;
  versioning_status?: string | null;
}

// E2E returns secret_key in key lists and bucket access lists; the CLI
// never reads it from there. A secret is shown only by key create.
export interface EosKeyApiItem {
  access_key: string;
  disabled?: boolean;
  id: number;
  secret_key?: string;
  tag?: string | null;
}

export interface EosCreatedKeyApiItem extends EosKeyApiItem {
  minio_host_url?: string;
}

export interface EosAccessApiItem {
  id: number;
  role: { display_name?: string; name: string };
  user: EosKeyApiItem;
}

export interface EosBucketItem {
  created_at: string;
  name: string;
  status: string;
  used_mb: number | null;
}

export interface EosKeyItem {
  access_key: string;
  disabled: boolean;
  id: number;
  name: string;
}

export interface EosAccessItem {
  access_key: string;
  id: number;
  key_name: string;
  // admin, writer or reader; any other role keeps E2E's own name.
  role: string;
}

export type EosRole = 'admin' | 'reader' | 'writer';

export interface EosContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface EosForceOptions extends EosContextOptions {
  force?: boolean;
}

export interface EosKeyCreateOptions extends EosContextOptions {
  name: string;
}

export interface EosAccessGrantOptions extends EosContextOptions {
  accessKey: string;
  role: EosRole;
}

export interface EosAccessRevokeOptions extends EosContextOptions {
  accessKey: string;
}

export type EosCommandResult =
  | { action: 'access-grant'; bucket: string; items: EosAccessItem[] }
  | { action: 'access-list'; bucket: string; items: EosAccessItem[] }
  | {
      access_key: string;
      action: 'access-revoke';
      bucket: string;
      message: string;
    }
  | { action: 'bucket-create'; bucket: EosBucketItem }
  | {
      action: 'bucket-delete';
      cancelled: boolean;
      message?: string;
      name: string;
    }
  | { action: 'bucket-list'; items: EosBucketItem[] }
  | {
      action: 'key-create';
      endpoint: string | null;
      key: EosKeyItem & { secret_key: string };
    }
  | {
      access_key: string;
      action: 'key-delete';
      cancelled: boolean;
      message?: string;
    }
  | { action: 'key-list'; items: EosKeyItem[] };
