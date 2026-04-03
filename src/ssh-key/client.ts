import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type { SshKeyCreateResult, SshKeySummary } from './types.js';

const SSH_KEYS_PATH = '/ssh_keys/';

export interface SshKeyClient {
  createSshKey(input: {
    label: string;
    ssh_key: string;
  }): Promise<SshKeyCreateResult>;
  deleteSshKey(sshKeyId: number): Promise<{ message: string }>;
  listSshKeys(): Promise<SshKeySummary[]>;
}

export class SshKeyApiClient implements SshKeyClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createSshKey(input: {
    label: string;
    ssh_key: string;
  }): Promise<SshKeyCreateResult> {
    const response = await this.transport.post<ApiEnvelope<SshKeyCreateResult>>(
      SSH_KEYS_PATH,
      {
        body: input
      }
    );

    return response.data;
  }

  async deleteSshKey(sshKeyId: number): Promise<{ message: string }> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, unknown>>
    >(buildDeleteSshKeyPath(sshKeyId));

    return mapDeleteSshKeyResponse(response);
  }

  async listSshKeys(): Promise<SshKeySummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<SshKeySummary[]>>(SSH_KEYS_PATH);

    return response.data;
  }
}

function buildDeleteSshKeyPath(sshKeyId: number): string {
  return `/delete_ssh_key/${sshKeyId}/`;
}

function mapDeleteSshKeyResponse(
  response: ApiEnvelope<Record<string, unknown>>
): { message: string } {
  return {
    message: response.message
  };
}
