import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import type { SslClient } from './client.js';
import type { SslCertificateSummary } from './types.js';

export interface SslContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface SslListCommandResult {
  action: 'list';
  items: SslCertificateSummary[];
}

export type SslCommandResult = SslListCommandResult;

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
