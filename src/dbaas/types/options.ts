export interface DbaasContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface DbaasListTypesOptions extends DbaasContextOptions {
  type?: string;
}

export interface DbaasPlansOptions extends DbaasContextOptions {
  dbVersion: string;
  type: string;
}

export interface DbaasListOptions extends DbaasContextOptions {
  type?: string;
}

export interface DbaasCreateOptions extends DbaasContextOptions {
  billingType?: string;
  committedPlanId?: string;
  committedRenewal?: string;
  databaseName: string;
  dbVersion: string;
  name: string;
  password?: string;
  passwordFile?: string;
  plan: string;
  publicIp?: boolean;
  subnetId?: string;
  type: string;
  username?: string;
  vpcId?: string;
}

export interface DbaasResetPasswordOptions extends DbaasContextOptions {
  password?: string;
  passwordFile?: string;
}

export interface DbaasDeleteOptions extends DbaasContextOptions {
  force?: boolean;
}

export interface DbaasAttachVpcOptions extends DbaasContextOptions {
  subnetId?: string;
  vpcId: string;
}

export type DbaasGetOptions = DbaasContextOptions;

export interface DbaasDetachVpcOptions extends DbaasContextOptions {
  subnetId?: string;
  vpcId: string;
}

export type DbaasPublicIpOptions = DbaasContextOptions;

export interface DbaasPublicIpDetachOptions extends DbaasContextOptions {
  force?: boolean;
}

export type DbaasWhitelistListOptions = DbaasContextOptions;

export interface DbaasWhitelistUpdateOptions extends DbaasContextOptions {
  ip: string;
  tagId?: string[];
}
