import type { ConfigFile, ResolvedCredentials } from '../../config/index.js';
import type { SupportTicketClient } from '../client.js';

export interface SupportTicketStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SupportTicketServiceDependencies {
  createSupportTicketClient(
    credentials: ResolvedCredentials
  ): SupportTicketClient;
  readAttachmentFile(path: string): Promise<Buffer>;
  store: SupportTicketStore;
}
