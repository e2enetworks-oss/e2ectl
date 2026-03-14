import {
  resolveCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SshKeyClient } from './client.js';
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

export type SshKeyCommandResult =
  | SshKeyCreateCommandResult
  | SshKeyListCommandResult;

interface SshKeyStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SshKeyServiceDependencies {
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  readPublicKeyFile(path: string): Promise<string>;
  readPublicKeyFromStdin(): Promise<string>;
  store: SshKeyStore;
}

export class SshKeyService {
  constructor(private readonly dependencies: SshKeyServiceDependencies) {}

  async createSshKey(
    options: SshKeyCreateOptions
  ): Promise<SshKeyCreateCommandResult> {
    const label = normalizeRequiredString(options.label, 'Label', '--label');
    const publicKeyFile = normalizeRequiredString(
      options.publicKeyFile,
      'Public key file',
      '--public-key-file'
    );
    const publicKey = await this.loadPublicKey(publicKeyFile);
    const client = await this.createClient(options);
    const createdKey = await client.createSshKey({
      label,
      ssh_key: publicKey
    });

    return {
      action: 'create',
      item: normalizeCreatedSshKeyItem(createdKey)
    };
  }

  async listSshKeys(
    options: SshKeyContextOptions
  ): Promise<SshKeyListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listSshKeys()).map((item) =>
        normalizeSshKeyItem(item)
      )
    };
  }

  private async createClient(
    options: SshKeyContextOptions
  ): Promise<SshKeyClient> {
    const config = await this.dependencies.store.read();
    const credentials = resolveCredentials({
      ...(options.alias === undefined ? {} : { alias: options.alias }),
      config,
      configPath: this.dependencies.store.configPath,
      ...(options.projectId === undefined
        ? {}
        : {
            projectId: options.projectId
          }),
      ...(options.location === undefined
        ? {}
        : {
            location: options.location
          })
    });

    return this.dependencies.createSshKeyClient(credentials);
  }

  private async loadPublicKey(publicKeyFile: string): Promise<string> {
    try {
      const content =
        publicKeyFile === '-'
          ? await this.dependencies.readPublicKeyFromStdin()
          : await this.dependencies.readPublicKeyFile(publicKeyFile);
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
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      throw new CliError(
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
  }
}

function inferSshKeyType(publicKey: string): string {
  const [prefix = ''] = publicKey.trim().split(/\s+/, 1);
  return SSH_KEY_TYPE_LABELS[prefix] ?? 'Unknown';
}

function normalizeCreatedSshKeyItem(item: SshKeyCreateResult): SshKeyItem {
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

function normalizeSshKeyItem(item: SshKeySummary): SshKeyItem {
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
