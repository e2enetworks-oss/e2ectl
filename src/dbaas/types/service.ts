import type { ConfigFile, ResolvedCredentials } from '../../config/index.js';
import type { VpcClient } from '../../vpc/client.js';
import type { DbaasClient } from '../client.js';
import type { DbaasCommittedRenewal } from './api.js';
import type {
  DbaasCreateBillingType,
  SupportedDatabaseType
} from './command.js';

export interface DbaasStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface DbaasServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createDbaasClient(credentials: ResolvedCredentials): DbaasClient;
  createVpcClient?: (credentials: ResolvedCredentials) => VpcClient;
  isInteractive: boolean;
  readPasswordFile(path: string): Promise<string>;
  readPasswordFromStdin(): Promise<string>;
  store: DbaasStore;
}

export interface DbaasPasswordOptions {
  password?: string;
  passwordFile?: string;
}

export interface NormalizedDbaasCreateInput {
  billingType: DbaasCreateBillingType;
  committedPlanId: number | null;
  committedRenewal: DbaasCommittedRenewal;
  databaseName: string;
  name: string;
  password: string;
  plan: string;
  publicIp: boolean;
  subnetId: number | null;
  type: SupportedDatabaseType;
  username: string;
  version: string;
  vpcId: number | null;
}
