import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { SshKeyService } from '../../../src/ssh-key/service.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

function createServiceFixture(): {
  createSshKey: ReturnType<typeof vi.fn>;
  listSshKeys: ReturnType<typeof vi.fn>;
  readPublicKeyFile: ReturnType<typeof vi.fn>;
  readPublicKeyFromStdin: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: SshKeyService;
} {
  const createSshKey = vi.fn();
  const listSshKeys = vi.fn();
  const readPublicKeyFile = vi.fn();
  const readPublicKeyFromStdin = vi.fn();
  let credentials: ResolvedCredentials | undefined;

  const client: SshKeyClient = {
    createSshKey,
    listSshKeys
  };
  const service = new SshKeyService({
    createSshKeyClient: vi.fn((resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    }),
    readPublicKeyFile,
    readPublicKeyFromStdin,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    createSshKey,
    listSshKeys,
    readPublicKeyFile,
    readPublicKeyFromStdin,
    receivedCredentials: () => credentials,
    service
  };
}

describe('SshKeyService', () => {
  it('reads SSH public keys from files and normalizes the created result', async () => {
    const { createSshKey, readPublicKeyFile, receivedCredentials, service } =
      createServiceFixture();

    readPublicKeyFile.mockResolvedValue(
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop\n'
    );
    createSshKey.mockResolvedValue({
      label: 'demo',
      pk: 15398,
      project_id: '46429',
      ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
      timestamp: '19-Feb-2025'
    });

    const result = await service.createSshKey({
      alias: 'prod',
      label: 'demo',
      publicKeyFile: '/tmp/demo.pub'
    });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(createSshKey).toHaveBeenCalledWith({
      label: 'demo',
      ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop'
    });
    expect(result).toEqual({
      action: 'create',
      item: {
        attached_nodes: 0,
        created_at: '19-Feb-2025',
        id: 15398,
        label: 'demo',
        project_id: '46429',
        project_name: null,
        public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
        type: 'ED25519'
      }
    });
  });

  it('reads SSH public keys from stdin when --public-key-file - is used', async () => {
    const { createSshKey, readPublicKeyFromStdin, service } =
      createServiceFixture();

    readPublicKeyFromStdin.mockResolvedValue(
      'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop\n'
    );
    createSshKey.mockResolvedValue({
      label: 'demo',
      pk: 15399,
      project_id: '46429',
      ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop',
      timestamp: '19-Feb-2025'
    });

    await service.createSshKey({
      alias: 'prod',
      label: 'demo',
      publicKeyFile: '-'
    });

    expect(readPublicKeyFromStdin).toHaveBeenCalledTimes(1);
    expect(createSshKey).toHaveBeenCalledWith({
      label: 'demo',
      ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop'
    });
  });

  it('rejects blank labels before reading key content', async () => {
    const { readPublicKeyFile, service } = createServiceFixture();

    await expect(
      service.createSshKey({
        label: '   ',
        publicKeyFile: '/tmp/demo.pub'
      })
    ).rejects.toMatchObject({
      message: 'Label cannot be empty.'
    });
    expect(readPublicKeyFile).not.toHaveBeenCalled();
  });

  it('rejects blank key content from files', async () => {
    const { readPublicKeyFile, service } = createServiceFixture();

    readPublicKeyFile.mockResolvedValue('   \n');

    await expect(
      service.createSshKey({
        label: 'demo',
        publicKeyFile: '/tmp/demo.pub'
      })
    ).rejects.toMatchObject({
      message: 'Public key content cannot be empty.'
    });
  });

  it('normalizes listed SSH keys into the clean CLI item shape', async () => {
    const { listSshKeys, service } = createServiceFixture();

    listSshKeys.mockResolvedValue([
      {
        label: 'demo',
        pk: 15398,
        project_name: 'default-project',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
        ssh_key_type: 'ED25519',
        timestamp: '19-Feb-2025',
        total_attached_nodes: 2
      }
    ]);

    const result = await service.listSshKeys({ alias: 'prod' });

    expect(result).toEqual({
      action: 'list',
      items: [
        {
          attached_nodes: 2,
          created_at: '19-Feb-2025',
          id: 15398,
          label: 'demo',
          project_id: null,
          project_name: 'default-project',
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
          type: 'ED25519'
        }
      ]
    });
  });
});
