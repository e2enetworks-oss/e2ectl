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

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  createSshKey: ReturnType<typeof vi.fn>;
  deleteSshKey: ReturnType<typeof vi.fn>;
  listSshKeys: ReturnType<typeof vi.fn>;
  readPublicKeyFile: ReturnType<typeof vi.fn>;
  readPublicKeyFromStdin: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: SshKeyService;
} {
  const createSshKey = vi.fn();
  const deleteSshKey = vi.fn();
  const listSshKeys = vi.fn();
  const readPublicKeyFile = vi.fn();
  const readPublicKeyFromStdin = vi.fn();
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  let credentials: ResolvedCredentials | undefined;

  const client: SshKeyClient = {
    createSshKey,
    deleteSshKey,
    listSshKeys
  };
  const service = new SshKeyService({
    confirm,
    createSshKeyClient: vi.fn((resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    }),
    isInteractive: options?.isInteractive ?? true,
    readPublicKeyFile,
    readPublicKeyFromStdin,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
    createSshKey,
    deleteSshKey,
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

  it('gets one SSH key by filtering the saved list', async () => {
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

    const result = await service.getSshKey('15398', { alias: 'prod' });

    expect(result).toEqual({
      action: 'get',
      item: {
        attached_nodes: 2,
        created_at: '19-Feb-2025',
        id: 15398,
        label: 'demo',
        project_id: null,
        project_name: 'default-project',
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

  it('rejects blank public-key-file values before trying to read anything', async () => {
    const { readPublicKeyFile, readPublicKeyFromStdin, service } =
      createServiceFixture();

    await expect(
      service.createSshKey({
        label: 'demo',
        publicKeyFile: '   '
      })
    ).rejects.toMatchObject({
      message: 'Public key file cannot be empty.'
    });

    expect(readPublicKeyFile).not.toHaveBeenCalled();
    expect(readPublicKeyFromStdin).not.toHaveBeenCalled();
  });

  it('wraps filesystem errors when reading SSH public keys from disk', async () => {
    const { createSshKey, readPublicKeyFile, service } = createServiceFixture();

    readPublicKeyFile.mockRejectedValue(new Error('permission denied'));

    await expect(
      service.createSshKey({
        label: 'demo',
        publicKeyFile: '/tmp/demo.pub'
      })
    ).rejects.toMatchObject({
      code: 'PUBLIC_KEY_READ_FAILED',
      message: 'Could not read SSH public key file: /tmp/demo.pub'
    });

    expect(createSshKey).not.toHaveBeenCalled();
  });

  it('wraps stdin read errors when --public-key-file - is used', async () => {
    const { createSshKey, readPublicKeyFromStdin, service } =
      createServiceFixture();

    readPublicKeyFromStdin.mockRejectedValue(new Error('stdin closed'));

    await expect(
      service.createSshKey({
        label: 'demo',
        publicKeyFile: '-'
      })
    ).rejects.toMatchObject({
      code: 'PUBLIC_KEY_READ_FAILED',
      message: 'Could not read SSH public key content from stdin.'
    });

    expect(createSshKey).not.toHaveBeenCalled();
  });

  it('infers Unknown key types when the backend does not label an unfamiliar prefix', async () => {
    const { createSshKey, readPublicKeyFile, service } = createServiceFixture();

    readPublicKeyFile.mockResolvedValue('ssh-weird AAAA demo@laptop\n');
    createSshKey.mockResolvedValue({
      label: 'demo',
      pk: 15400,
      project_id: '46429',
      ssh_key: 'ssh-weird AAAA demo@laptop',
      timestamp: '19-Feb-2025'
    });

    const result = await service.createSshKey({
      alias: 'prod',
      label: 'demo',
      publicKeyFile: '/tmp/demo.pub'
    });

    expect(result).toEqual({
      action: 'create',
      item: {
        attached_nodes: 0,
        created_at: '19-Feb-2025',
        id: 15400,
        label: 'demo',
        project_id: '46429',
        project_name: null,
        public_key: 'ssh-weird AAAA demo@laptop',
        type: 'Unknown'
      }
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

  it('fails clearly when a requested SSH key id is missing from the saved list', async () => {
    const { listSshKeys, service } = createServiceFixture();

    listSshKeys.mockResolvedValue([]);

    await expect(
      service.getSshKey('15398', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'SSH_KEY_NOT_FOUND',
      message: 'SSH key 15398 was not found.'
    });
  });

  it('rejects non-numeric SSH key ids for get before any network work', async () => {
    const { listSshKeys, service } = createServiceFixture();

    await expect(
      service.getSshKey('demo', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_SSH_KEY_ID',
      message: 'SSH key ID must be numeric.'
    });

    expect(listSshKeys).not.toHaveBeenCalled();
  });

  it('rejects non-numeric SSH key ids for delete before any network work', async () => {
    const { deleteSshKey, service } = createServiceFixture();

    await expect(
      service.deleteSshKey('demo', {
        alias: 'prod',
        force: true
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SSH_KEY_ID',
      message: 'SSH key ID must be numeric.'
    });

    expect(deleteSshKey).not.toHaveBeenCalled();
  });

  it('returns a cancelled delete result when the confirmation prompt is declined', async () => {
    const { confirm, deleteSshKey, service } = createServiceFixture({
      confirmResult: false
    });

    const result = await service.deleteSshKey('15398', { alias: 'prod' });

    expect(confirm).toHaveBeenCalledWith(
      'Delete SSH key 15398? This cannot be undone.'
    );
    expect(deleteSshKey).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'delete',
      cancelled: true,
      id: 15398
    });
  });

  it('requires --force for delete in non-interactive mode', async () => {
    const { deleteSshKey, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteSshKey('15398', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a SSH key requires confirmation in an interactive terminal.'
    });

    expect(deleteSshKey).not.toHaveBeenCalled();
  });

  it('deletes one SSH key with an explicit force flag', async () => {
    const { deleteSshKey, service } = createServiceFixture();

    deleteSshKey.mockResolvedValue({
      message: 'SSH Key has been deleted successfully.'
    });

    const result = await service.deleteSshKey('15398', {
      alias: 'prod',
      force: true
    });

    expect(deleteSshKey).toHaveBeenCalledWith(15398);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      id: 15398,
      message: 'SSH Key has been deleted successfully.'
    });
  });

  it('confirms interactive deletes before calling the backend', async () => {
    const { confirm, deleteSshKey, service } = createServiceFixture();

    deleteSshKey.mockResolvedValue({
      message: 'SSH Key has been deleted successfully.'
    });

    const result = await service.deleteSshKey('15398', { alias: 'prod' });

    expect(confirm).toHaveBeenCalledWith(
      'Delete SSH key 15398? This cannot be undone.'
    );
    expect(deleteSshKey).toHaveBeenCalledWith(15398);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      id: 15398,
      message: 'SSH Key has been deleted successfully.'
    });
  });
});
