import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  SecurityGroupCreateRequest,
  SecurityGroupCreateResult,
  SecurityGroupDeleteResult,
  SecurityGroupNodeActionRequest,
  SecurityGroupNodeActionResult,
  SecurityGroupSummary,
  SecurityGroupUpdateRequest
} from './types.js';

const SECURITY_GROUPS_PATH = '/security_group/';

export interface SecurityGroupClient {
  attachNodeSecurityGroups(
    vmId: number,
    body: SecurityGroupNodeActionRequest
  ): Promise<SecurityGroupNodeActionResult>;
  createSecurityGroup(body: SecurityGroupCreateRequest): Promise<{
    message: string;
    result: SecurityGroupCreateResult;
  }>;
  deleteSecurityGroup(securityGroupId: number): Promise<{
    message: string;
    result: SecurityGroupDeleteResult;
  }>;
  detachNodeSecurityGroups(
    vmId: number,
    body: SecurityGroupNodeActionRequest
  ): Promise<SecurityGroupNodeActionResult>;
  getSecurityGroup(securityGroupId: number): Promise<SecurityGroupSummary>;
  listSecurityGroups(): Promise<SecurityGroupSummary[]>;
  updateSecurityGroup(
    securityGroupId: number,
    body: SecurityGroupUpdateRequest
  ): Promise<{
    message: string;
  }>;
}

export class SecurityGroupApiClient implements SecurityGroupClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachNodeSecurityGroups(
    vmId: number,
    body: SecurityGroupNodeActionRequest
  ): Promise<SecurityGroupNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<Record<string, never>>
    >(buildNodeActionPath(vmId, 'attach'), {
      body
    });

    return {
      message: response.message
    };
  }

  async createSecurityGroup(body: SecurityGroupCreateRequest): Promise<{
    message: string;
    result: SecurityGroupCreateResult;
  }> {
    const response = await this.transport.post<
      ApiEnvelope<SecurityGroupCreateResult>
    >(SECURITY_GROUPS_PATH, {
      body
    });

    return {
      message: response.message,
      result: response.data
    };
  }

  async deleteSecurityGroup(securityGroupId: number): Promise<{
    message: string;
    result: SecurityGroupDeleteResult;
  }> {
    const response = await this.transport.delete<
      ApiEnvelope<SecurityGroupDeleteResult>
    >(buildSecurityGroupPath(securityGroupId));

    return {
      message: response.message,
      result: response.data
    };
  }

  async detachNodeSecurityGroups(
    vmId: number,
    body: SecurityGroupNodeActionRequest
  ): Promise<SecurityGroupNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<Record<string, never>>
    >(buildNodeActionPath(vmId, 'detach'), {
      body
    });

    return {
      message: response.message
    };
  }

  async getSecurityGroup(
    securityGroupId: number
  ): Promise<SecurityGroupSummary> {
    const response = await this.transport.get<
      ApiEnvelope<SecurityGroupSummary>
    >(buildSecurityGroupPath(securityGroupId));

    return response.data;
  }

  async listSecurityGroups(): Promise<SecurityGroupSummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<SecurityGroupSummary[]>>(
        SECURITY_GROUPS_PATH
      );

    return response.data;
  }

  async updateSecurityGroup(
    securityGroupId: number,
    body: SecurityGroupUpdateRequest
  ): Promise<{
    message: string;
  }> {
    const response = await this.transport.request<ApiEnvelope<string>>({
      body,
      method: 'PUT',
      path: buildSecurityGroupPath(securityGroupId)
    });

    return {
      message: response.message
    };
  }
}

function buildNodeActionPath(
  vmId: number,
  action: 'attach' | 'detach'
): string {
  return `${buildSecurityGroupPath(vmId)}${action}/`;
}

function buildSecurityGroupPath(securityGroupId: number): string {
  return `${SECURITY_GROUPS_PATH}${securityGroupId}/`;
}
