import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SshKeyClient, SshKeyCreateRequest } from './client.js';
import type { SshKeyCreateResult, SshKeySummary } from './types.js';

const SSH_KEY_TYPE_LABELS: Record<string, string> = {
  'ecdsa-sha2-nistp256': 'ECDSA',
  'ecdsa-sha2-nistp384': 'ECDSA',
  'ecdsa-sha2-nistp521': 'ECDSA',
  'sk-ecdsa-sha2-nistp256@openssh.com': 'ECDSA_SK',
  'sk-ssh-ed25519@openssh.com': 'ED25519_SK',
  'ssh-dss': 'DSA',
  'ssh-ed25519': 'ED25519',
  'ssh-rsa': 'RSA'
};

export interface SshKeyContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface SshKeyCreateOptions extends SshKeyContextOptions {
  label: string;
  publicKeyFile: string;
}

export interface SshKeyDeleteOptions extends SshKeyContextOptions {
  force?: boolean;
}

export interface SshKeyItem {
  attached_nodes: number;
  created_at: string;
  id: number;
  label: string;
  project_id: string | null;
  project_name: string | null;
  public_key: string;
  type: string;
}

export interface SshKeyListCommandResult {
  action: 'list';
  items: SshKeyItem[];
}

export interface SshKeyCreateCommandResult {
  action: 'create';
  item: SshKeyItem;
}

export interface SshKeyDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  id: number;
  message?: string;
}

export interface SshKeyGetCommandResult {
  action: 'get';
  item: SshKeyItem;
}

export type SshKeyCommandResult =
  | SshKeyCreateCommandResult
  | SshKeyDeleteCommandResult
  | SshKeyGetCommandResult
  | SshKeyListCommandResult;

interface SshKeyStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SshKeyServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  isInteractive: boolean;
  readPublicKeyFile(path: string): Promise<string>;
  readPublicKeyFromStdin(): Promise<string>;
  store: SshKeyStore;
}

interface NormalizedSshKeyCreateInput {
  label: string;
  publicKeyFile: string;
}

export class SshKeyService {
  constructor(private readonly dependencies: SshKeyServiceDependencies) {}

  async createSshKey(
    options: SshKeyCreateOptions
  ): Promise<SshKeyCreateCommandResult> {
    const input = normalizeSshKeyCreateInput(options);
    const publicKey = await this.loadPublicKey(input.publicKeyFile);
    const client = await this.createClient(options);
    const createdKey = await client.createSshKey(
      buildSshKeyCreateRequest(input.label, publicKey)
    );

    return {
      action: 'create',
      item: summarizeCreatedSshKey(createdKey)
    };
  }

  async deleteSshKey(
    sshKeyId: string,
    options: SshKeyDeleteOptions
  ): Promise<SshKeyDeleteCommandResult> {
    const normalizedSshKeyId = normalizeSshKeyId(sshKeyId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive, 'SSH key');
      const confirmed = await this.dependencies.confirm(
        `Delete SSH key ${normalizedSshKeyId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          id: normalizedSshKeyId
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.deleteSshKey(normalizedSshKeyId);

    return {
      action: 'delete',
      cancelled: false,
      id: normalizedSshKeyId,
      message: result.message
    };
  }

  async getSshKey(
    sshKeyId: string,
    options: SshKeyContextOptions
  ): Promise<SshKeyGetCommandResult> {
    const normalizedSshKeyId = normalizeSshKeyId(sshKeyId);
    const client = await this.createClient(options);
    const item = findSshKeyById(await client.listSshKeys(), normalizedSshKeyId);

    return {
      action: 'get',
      item: summarizeListedSshKey(item)
    };
  }

  async listSshKeys(
    options: SshKeyContextOptions
  ): Promise<SshKeyListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listSshKeys()).map((item) =>
        summarizeListedSshKey(item)
      )
    };
  }

  private async createClient(
    options: SshKeyContextOptions
  ): Promise<SshKeyClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createSshKeyClient(credentials);
  }

  private async loadPublicKey(publicKeyFile: string): Promise<string> {
    try {
      const content =
        publicKeyFile === '-'
          ? await this.dependencies.readPublicKeyFromStdin()
          : await this.dependencies.readPublicKeyFile(publicKeyFile);
      return normalizeLoadedPublicKey(content);
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      throw wrapPublicKeyReadError(publicKeyFile, error);
    }
  }
}

function inferSshKeyType(publicKey: string): string {
  const [prefix = ''] = publicKey.trim().split(/\s+/, 1);
  return SSH_KEY_TYPE_LABELS[prefix] ?? 'Unknown';
}

function normalizeSshKeyCreateInput(
  options: SshKeyCreateOptions
): NormalizedSshKeyCreateInput {
  return {
    label: normalizeRequiredString(options.label, 'Label', '--label'),
    publicKeyFile: normalizeRequiredString(
      options.publicKeyFile,
      'Public key file',
      '--public-key-file'
    )
  };
}

function buildSshKeyCreateRequest(
  label: string,
  publicKey: string
): SshKeyCreateRequest {
  return {
    label,
    ssh_key: publicKey
  };
}

function normalizeLoadedPublicKey(content: string): string {
  const normalized = content.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError('Public key content cannot be empty.', {
    code: 'EMPTY_PUBLIC_KEY',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Provide a file with SSH public key material, or pipe it in with --public-key-file -.'
  });
}

function wrapPublicKeyReadError(
  publicKeyFile: string,
  error: unknown
): CliError {
  return new CliError(
    publicKeyFile === '-'
      ? 'Could not read SSH public key content from stdin.'
      : `Could not read SSH public key file: ${publicKeyFile}`,
    {
      code: 'PUBLIC_KEY_READ_FAILED',
      cause: error,
      exitCode: EXIT_CODES.usage,
      suggestion:
        publicKeyFile === '-'
          ? `Pipe a public key into the command, for example: cat ~/.ssh/id_ed25519.pub | ${formatCliCommand('ssh-key create --label demo --public-key-file -')}`
          : 'Verify that the file exists, is readable, and contains a public SSH key.'
    }
  );
}

function findSshKeyById(
  items: SshKeySummary[],
  sshKeyId: number
): SshKeySummary {
  const item = items.find((candidate) => candidate.pk === sshKeyId);
  if (item !== undefined) {
    return item;
  }

  throw new CliError(`SSH key ${sshKeyId} was not found.`, {
    code: 'SSH_KEY_NOT_FOUND',
    exitCode: EXIT_CODES.network,
    suggestion: `Run ${formatCliCommand('ssh-key list')} to inspect the available saved SSH keys.`
  });
}

function summarizeCreatedSshKey(item: SshKeyCreateResult): SshKeyItem {
  return {
    attached_nodes: 0,
    created_at: item.timestamp,
    id: item.pk,
    label: item.label,
    project_id: item.project_id ?? null,
    project_name: null,
    public_key: item.ssh_key,
    type: inferSshKeyType(item.ssh_key)
  };
}

function summarizeListedSshKey(item: SshKeySummary): SshKeyItem {
  return {
    attached_nodes: item.total_attached_nodes ?? 0,
    created_at: item.timestamp,
    id: item.pk,
    label: item.label,
    project_id: null,
    project_name: item.project_name ?? null,
    public_key: item.ssh_key,
    type: item.ssh_key_type ?? inferSshKeyType(item.ssh_key)
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
    `Deleting a ${resourceName} requires confirmation in an interactive terminal.`,
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function normalizeSshKeyId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliError('SSH key ID must be numeric.', {
      code: 'INVALID_SSH_KEY_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric SSH key id as the first argument.'
    });
  }

  return Number(value);
}
