import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type { SshKeyCreateResult, SshKeySummary } from './types.js';

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
      '/ssh_keys/',
      {
        body: input
      }
    );

    return response.data;
  }

  async deleteSshKey(sshKeyId: number): Promise<{ message: string }> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, unknown>>
    >(`/delete_ssh_key/${sshKeyId}/`);

    return {
      message: response.message
    };
  }

  async listSshKeys(): Promise<SshKeySummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<SshKeySummary[]>>('/ssh_keys/');

    return response.data;
  }
}
