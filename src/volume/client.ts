import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  VolumeCreateRequest,
  VolumeCreateResult,
  VolumeDetails,
  VolumeListResult,
  VolumeNodeActionRequest,
  VolumeNodeActionResult,
  VolumePlan,
  VolumeSummary
} from './types.js';

type VolumeListApiResponse = ApiResponse<
  VolumeSummary[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

export interface VolumeClient {
  attachVolumeToNode(
    volumeId: number,
    body: VolumeNodeActionRequest
  ): Promise<VolumeNodeActionResult>;
  createVolume(body: VolumeCreateRequest): Promise<VolumeCreateResult>;
  deleteVolume(volumeId: number): Promise<{ message: string }>;
  detachVolumeFromNode(
    volumeId: number,
    body: VolumeNodeActionRequest
  ): Promise<VolumeNodeActionResult>;
  getVolume(volumeId: number): Promise<VolumeDetails>;
  listVolumePlans(): Promise<VolumePlan[]>;
  listVolumes(pageNumber: number, perPage: number): Promise<VolumeListResult>;
}

export class VolumeApiClient implements VolumeClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachVolumeToNode(
    volumeId: number,
    body: VolumeNodeActionRequest
  ): Promise<VolumeNodeActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Omit<VolumeNodeActionResult, 'message'>>
    >({
      body,
      method: 'PUT',
      path: `/block_storage/${volumeId}/vm/attach/`
    });

    return {
      message: response.message,
      ...response.data
    };
  }

  async createVolume(body: VolumeCreateRequest): Promise<VolumeCreateResult> {
    const response = await this.transport.post<ApiEnvelope<VolumeCreateResult>>(
      '/block_storage/',
      {
        body
      }
    );

    return response.data;
  }

  async deleteVolume(volumeId: number): Promise<{ message: string }> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, unknown>>
    >(`/block_storage/${volumeId}/`);

    return {
      message: response.message
    };
  }

  async detachVolumeFromNode(
    volumeId: number,
    body: VolumeNodeActionRequest
  ): Promise<VolumeNodeActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Omit<VolumeNodeActionResult, 'message'>>
    >({
      body,
      method: 'PUT',
      path: `/block_storage/${volumeId}/vm/detach/`
    });

    return {
      message: response.message,
      ...response.data
    };
  }

  async getVolume(volumeId: number): Promise<VolumeDetails> {
    const response = await this.transport.get<ApiEnvelope<VolumeDetails>>(
      `/block_storage/${volumeId}/`
    );

    return response.data;
  }

  async listVolumePlans(): Promise<VolumePlan[]> {
    const response = await this.transport.get<ApiEnvelope<VolumePlan[]>>(
      '/block_storage/plans/'
    );

    return response.data;
  }

  async listVolumes(
    pageNumber: number,
    perPage: number
  ): Promise<VolumeListResult> {
    const response = await this.transport.get<VolumeListApiResponse>(
      '/block_storage/',
      {
        query: {
          page_no: String(pageNumber),
          per_page: String(perPage)
        }
      }
    );

    return {
      items: response.data,
      ...(response.total_count === undefined
        ? {}
        : { total_count: response.total_count }),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
  }
}
