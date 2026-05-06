import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import type { SslClient } from './client.js';
import type { SslContextOptions, SslListCommandResult } from './types/index.js';

interface SslStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SslServiceDependencies {
  createSslClient(credentials: ResolvedCredentials): SslClient;
  store: SslStore;
}

export class SslService {
  constructor(private readonly dependencies: SslServiceDependencies) {}

  async listCertificates(
    options: SslContextOptions
  ): Promise<SslListCommandResult> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createSslClient(credentials);
    const items = await client.listCertificates();

    return { action: 'list', items };
  }
}
