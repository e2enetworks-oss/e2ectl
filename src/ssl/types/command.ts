import type { SslCertificateSummary } from './api.js';

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
