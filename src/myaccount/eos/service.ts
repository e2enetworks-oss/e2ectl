import {
  resolveStoredCredentials,
  type CredentialResolutionStore,
  type ResolvedCredentials
} from '../../config/index.js';
import { confirmUnlessForced } from '../../core/confirm.js';
import { normalizeRequiredString } from '../../core/normalize.js';
import { CliError, EXIT_CODES } from '../../core/errors.js';
import { formatMyAccountCommand } from '../api.js';
import type { EosClient } from './client.js';
import type {
  EosAccessApiItem,
  EosAccessGrantOptions,
  EosAccessRevokeOptions,
  EosAccessItem,
  EosBucketApiItem,
  EosBucketItem,
  EosCommandResult,
  EosContextOptions,
  EosForceOptions,
  EosKeyApiItem,
  EosKeyCreateOptions,
  EosKeyItem,
  EosRole
} from './types.js';

// The roles E2E offers on a bucket, by the name it expects.
const ROLE_NAMES: Record<EosRole, string> = {
  admin: 'Bucket Admin',
  reader: 'Bucket Reader',
  writer: 'Bucket Writer'
};

export interface EosServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createEosClient(credentials: ResolvedCredentials): EosClient;
  isInteractive: boolean;
  store: CredentialResolutionStore;
}

export class EosService {
  constructor(private readonly dependencies: EosServiceDependencies) {}

  async listBuckets(options: EosContextOptions): Promise<EosCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'bucket-list',
      items: (await client.listBuckets()).map(toBucketItem)
    };
  }

  async createBucket(
    name: string,
    options: EosContextOptions
  ): Promise<EosCommandResult> {
    const bucket = normalizeBucketName(name);
    const client = await this.createClient(options);

    return {
      action: 'bucket-create',
      bucket: toBucketItem(await client.createBucket(bucket))
    };
  }

  async deleteBucket(
    name: string,
    options: EosForceOptions
  ): Promise<EosCommandResult> {
    const bucket = normalizeBucketName(name);
    const confirmed = await confirmUnlessForced(
      this.dependencies,
      options.force,
      `Delete bucket ${bucket} and every object in it? This cannot be undone.`
    );
    if (!confirmed) {
      return { action: 'bucket-delete', cancelled: true, name: bucket };
    }

    const client = await this.createClient(options);
    const result = await client.deleteBucket(bucket);

    return {
      action: 'bucket-delete',
      cancelled: false,
      message: result.message,
      name: bucket
    };
  }

  async listKeys(options: EosContextOptions): Promise<EosCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'key-list',
      items: (await client.listKeys()).map(toKeyItem)
    };
  }

  async createKey(options: EosKeyCreateOptions): Promise<EosCommandResult> {
    const name = normalizeKeyName(options.name);
    const client = await this.createClient(options);
    const created = await client.createKey(name);
    // The secret is shown only here; without it the key is no use.
    if (created.secret_key === undefined || created.secret_key === '') {
      throw new CliError(
        `Access key ${created.access_key} was created, but E2E sent no secret key for it.`,
        {
          code: 'EOS_KEY_SECRET_MISSING',
          exitCode: EXIT_CODES.network,
          suggestion: `Delete it with ${formatMyAccountCommand(`eos key delete ${created.access_key}`)} and create another.`
        }
      );
    }

    return {
      action: 'key-create',
      endpoint: created.minio_host_url ?? null,
      key: { ...toKeyItem(created), secret_key: created.secret_key }
    };
  }

  async deleteKey(
    accessKey: string,
    options: EosForceOptions
  ): Promise<EosCommandResult> {
    const key = normalizeRequiredString(accessKey, 'Access key', '<accessKey>');
    const client = await this.createClient(options);
    // E2E reports success for a key that does not exist, so check first.
    await findKey(client, key);
    const confirmed = await confirmUnlessForced(
      this.dependencies,
      options.force,
      `Delete access key ${key}? Anything using it stops working.`
    );
    if (!confirmed) {
      return { access_key: key, action: 'key-delete', cancelled: true };
    }

    const result = await client.deleteKey(key);

    return {
      access_key: key,
      action: 'key-delete',
      cancelled: false,
      message: result.message
    };
  }

  async listAccess(
    bucket: string,
    options: EosContextOptions
  ): Promise<EosCommandResult> {
    const name = normalizeBucketName(bucket);
    const client = await this.createClient(options);

    return {
      action: 'access-list',
      bucket: name,
      items: (await client.listAccess(name)).map(toAccessItem)
    };
  }

  async grantAccess(
    bucket: string,
    options: EosAccessGrantOptions
  ): Promise<EosCommandResult> {
    const name = normalizeBucketName(bucket);
    const accessKey = normalizeRequiredString(
      options.accessKey,
      'Access key',
      '--access-key'
    );
    const client = await this.createClient(options);
    const key = await findKey(client, accessKey);

    const items = await client.grantAccess(name, {
      role_name: ROLE_NAMES[options.role],
      users: [{ id: key.id }]
    });

    return {
      action: 'access-grant',
      bucket: name,
      items: items.map(toAccessItem)
    };
  }

  // Revokes by access key, like grant. revoke has no prompt: access can be
  // granted again at any time.
  async revokeAccess(
    bucket: string,
    options: EosAccessRevokeOptions
  ): Promise<EosCommandResult> {
    const name = normalizeBucketName(bucket);
    const accessKey = normalizeRequiredString(
      options.accessKey,
      'Access key',
      '--access-key'
    );
    const client = await this.createClient(options);
    const entries = (await client.listAccess(name)).filter(
      (entry) => entry.user.access_key === accessKey
    );
    if (entries.length === 0) {
      throw new CliError(
        `Access key ${accessKey} has no access to bucket ${name}.`,
        {
          code: 'EOS_ACCESS_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatMyAccountCommand(`eos access list ${name}`)} to see which keys can use it.`
        }
      );
    }

    let message = '';
    for (const entry of entries) {
      message = (await client.revokeAccess(name, entry.id)).message;
    }

    return {
      access_key: accessKey,
      action: 'access-revoke',
      bucket: name,
      message
    };
  }

  private async createClient(options: EosContextOptions): Promise<EosClient> {
    return this.dependencies.createEosClient(
      await resolveStoredCredentials(this.dependencies.store, options)
    );
  }
}

function toBucketItem(bucket: EosBucketApiItem): EosBucketItem {
  const used = Number(bucket.used_MB);

  return {
    created_at: bucket.created_at ?? '',
    name: bucket.name,
    status: bucket.status ?? '',
    used_mb: bucket.used_MB === null || Number.isNaN(used) ? null : used
  };
}

function toKeyItem(key: EosKeyApiItem): EosKeyItem {
  return {
    access_key: key.access_key,
    disabled: key.disabled === true,
    id: key.id,
    name: key.tag ?? ''
  };
}

function toAccessItem(access: EosAccessApiItem): EosAccessItem {
  const role = (Object.keys(ROLE_NAMES) as EosRole[]).find(
    (candidate) => ROLE_NAMES[candidate] === access.role.name
  );

  return {
    access_key: access.user.access_key,
    id: access.id,
    key_name: access.user.tag ?? '',
    role: role ?? access.role.name
  };
}

// E2E's rule for access key names.
function normalizeKeyName(value: string): string {
  const name = value.trim();
  if (/^[A-Za-z0-9]{3,50}$/.test(name)) {
    return name;
  }

  throw new CliError(`Access key name "${value}" is not allowed.`, {
    code: 'INVALID_EOS_KEY_NAME',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Use 3 to 50 letters and digits, with no spaces or dashes, for example --name ci2026.'
  });
}

async function findKey(
  client: EosClient,
  accessKey: string
): Promise<EosKeyApiItem> {
  const key = (await client.listKeys()).find(
    (candidate) => candidate.access_key === accessKey
  );
  if (key !== undefined) {
    return key;
  }

  throw new CliError(`Access key ${accessKey} was not found.`, {
    code: 'EOS_KEY_NOT_FOUND',
    exitCode: EXIT_CODES.usage,
    suggestion: `Run ${formatMyAccountCommand('eos key list')} and pass a listed access key.`
  });
}

// E2E's bucket name rule. Checking it also keeps names like ".." out of
// the API path.
function normalizeBucketName(value: string): string {
  const name = value.trim();
  if (/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) {
    return name;
  }

  throw new CliError(`"${value}" is not a valid bucket name.`, {
    code: 'INVALID_EOS_BUCKET_NAME',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Use 3 to 63 lowercase letters, digits, dots and dashes, starting and ending with a letter or digit.'
  });
}
