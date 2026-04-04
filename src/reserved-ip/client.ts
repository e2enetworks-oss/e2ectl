import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  ReservedIpDeleteResult,
  ReservedIpNodeActionRequest,
  ReservedIpNodeActionResult,
  ReservedIpReserveNodeRequest,
  ReservedIpSummary
} from './types.js';

interface ReservedIpNodeActionApiResult {
  IP?: string;
  ip_address?: string;
  message?: string;
  status?: string;
  vm_id?: number;
  vm_name?: string;
}

const RESERVED_IPS_PATH = '/reserve_ips/';

export interface ReservedIpClient {
  attachReservedIpToNode(
    ipAddress: string,
    body: ReservedIpNodeActionRequest
  ): Promise<ReservedIpNodeActionResult>;
  createReservedIp(): Promise<ReservedIpSummary>;
  deleteReservedIp(ipAddress: string): Promise<ReservedIpDeleteResult>;
  detachReservedIpFromNode(
    ipAddress: string,
    body: ReservedIpNodeActionRequest
  ): Promise<ReservedIpNodeActionResult>;
  listReservedIps(): Promise<ReservedIpSummary[]>;
  reserveNodePublicIp(
    ipAddress: string,
    body: ReservedIpReserveNodeRequest
  ): Promise<ReservedIpNodeActionResult>;
}

export class ReservedIpApiClient implements ReservedIpClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachReservedIpToNode(
    ipAddress: string,
    body: ReservedIpNodeActionRequest
  ): Promise<ReservedIpNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<ReservedIpNodeActionApiResult>
    >(buildReservedIpActionPath(ipAddress), {
      body
    });

    return mapReservedIpNodeActionResponse(response, ipAddress);
  }

  async createReservedIp(): Promise<ReservedIpSummary> {
    const response =
      await this.transport.post<ApiEnvelope<ReservedIpSummary>>(
        RESERVED_IPS_PATH
      );

    return response.data;
  }

  async deleteReservedIp(ipAddress: string): Promise<ReservedIpDeleteResult> {
    const response = await this.transport.delete<
      ApiEnvelope<{ message?: string }>
    >(buildReservedIpActionPath(ipAddress));

    return {
      message: response.data.message ?? response.message
    };
  }

  async detachReservedIpFromNode(
    ipAddress: string,
    body: ReservedIpNodeActionRequest
  ): Promise<ReservedIpNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<ReservedIpNodeActionApiResult>
    >(buildReservedIpActionPath(ipAddress), {
      body
    });

    return mapReservedIpNodeActionResponse(response, ipAddress);
  }

  async listReservedIps(): Promise<ReservedIpSummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<ReservedIpSummary[]>>(
        RESERVED_IPS_PATH
      );

    return response.data;
  }

  async reserveNodePublicIp(
    ipAddress: string,
    body: ReservedIpReserveNodeRequest
  ): Promise<ReservedIpNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<ReservedIpNodeActionApiResult>
    >(buildReservedIpActionPath(ipAddress), {
      body
    });

    return mapReservedIpNodeActionResponse(response, ipAddress);
  }
}

function buildReservedIpActionPath(ipAddress: string): string {
  return `${RESERVED_IPS_PATH}${ipAddress}/actions/`;
}

function mapReservedIpNodeActionResponse(
  response: ApiEnvelope<ReservedIpNodeActionApiResult>,
  ipAddress: string
): ReservedIpNodeActionResult {
  return {
    ip_address: response.data.IP ?? response.data.ip_address ?? ipAddress,
    message: response.data.message ?? response.message,
    status: response.data.status ?? null,
    vm_id:
      response.data.vm_id !== undefined && Number.isInteger(response.data.vm_id)
        ? response.data.vm_id
        : null,
    vm_name: response.data.vm_name ?? null
  };
}
