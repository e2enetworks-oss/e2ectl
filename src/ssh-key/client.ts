import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type { SshKeyCreateResult, SshKeySummary } from './types.js';

export interface SshKeyClient {
  createSshKey(input: {
    label: string;
    ssh_key: string;
  }): Promise<SshKeyCreateResult>;
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

  async listSshKeys(): Promise<SshKeySummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<SshKeySummary[]>>('/ssh_keys/');

    return response.data;
  }
}
