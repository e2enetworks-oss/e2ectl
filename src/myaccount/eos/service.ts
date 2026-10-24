import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../../config/index.js';
import { CliError, EXIT_CODES } from '../../core/errors.js';
import { formatMyAccountCommand } from '../api.js';
import type { EosClient } from './client.js';
import type {
  EosAccessApiItem,
  EosAccessGrantOptions,
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

interface EosStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface EosServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createEosClient(credentials: ResolvedCredentials): EosClient;
  isInteractive: boolean;
  store: EosStore;
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
    const confirmed = await this.confirmUnlessForced(
      options,
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
    const key = requireText(accessKey, 'Access key', 'the first argument');
    const client = await this.createClient(options);
    // E2E reports success for a key that does not exist, so check first.
    await findKey(client, key);
    const confirmed = await this.confirmUnlessForced(
      options,
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
    const role = normalizeRole(options.role);
    const accessKey = requireText(
      options.accessKey,
      'Access key',
      '--access-key'
    );
    const client = await this.createClient(options);
    const key = await findKey(client, accessKey);

    const items = await client.grantAccess(name, {
      role_name: ROLE_NAMES[role],
      users: [{ id: key.id }]
    });

    return {
      action: 'access-grant',
      bucket: name,
      items: items.map(toAccessItem)
    };
  }

  async revokeAccess(
    bucket: string,
    accessId: string,
    options: EosContextOptions
  ): Promise<EosCommandResult> {
    const name = normalizeBucketName(bucket);
    if (!/^\d+$/.test(accessId.trim())) {
      throw new CliError('Access ID must be numeric.', {
        code: 'INVALID_EOS_ACCESS_ID',
        exitCode: EXIT_CODES.usage,
        suggestion: `Pass the ID column from ${formatMyAccountCommand(`eos access list ${name}`)}.`
      });
    }

    const id = Number(accessId.trim());
    const client = await this.createClient(options);
    const result = await client.revokeAccess(name, id);

    return {
      access_id: id,
      action: 'access-revoke',
      bucket: name,
      message: result.message
    };
  }

  private async confirmUnlessForced(
    options: EosForceOptions,
    question: string
  ): Promise<boolean> {
    if (options.force ?? false) {
      return true;
    }

    if (!this.dependencies.isInteractive) {
      throw new CliError(
        'This delete needs confirmation in an interactive terminal.',
        {
          code: 'CONFIRMATION_REQUIRED',
          exitCode: EXIT_CODES.usage,
          suggestion: 'Re-run the command with --force to skip the prompt.'
        }
      );
    }

    return await this.dependencies.confirm(question);
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

function normalizeRole(value: string): EosRole {
  const role = value.trim().toLowerCase();
  // Own keys only: `in` also accepts names like "constructor".
  if (Object.hasOwn(ROLE_NAMES, role)) {
    return role as EosRole;
  }

  throw new CliError(`Unknown role "${value}".`, {
    code: 'INVALID_EOS_ROLE',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass --role admin, --role writer or --role reader.'
  });
}

function requireText(value: string, label: string, where: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value as ${where}.`
  });
}
