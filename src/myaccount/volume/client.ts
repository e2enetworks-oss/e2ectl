import type {
  ApiEnvelope,
  ApiResponse,
  ApiTransport
} from '../../http/index.js';

import type { SnapshotApiItem } from '../snapshot/index.js';
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

const BLOCK_STORAGE_PATH = '/block_storage/';
const BLOCK_STORAGE_PLANS_PATH = '/block_storage/plans/';

// Snapshot quirks: the volume must be attached to a node; one snapshot is
// addressed by its snapshot_id (not snapshot_uuid as for nodes), on a path
// with no trailing slash; restore is a PUT that saves it as a new volume.
export interface VolumeClient {
  createSnapshot(volumeId: number, name: string): Promise<{ message: string }>;
  deleteSnapshot(
    volumeId: number,
    snapshotId: string
  ): Promise<{ message: string }>;
  listSnapshots(volumeId: number): Promise<SnapshotApiItem[]>;
  // E2E resizes through the attached node and renames the volume to
  // `name`, so the current name must be sent to keep it.
  resizeVolume(
    volumeId: number,
    body: { block_storage_size: number; name: string; vm_id: number }
  ): Promise<{ message: string }>;
  saveSnapshotAsVolume(
    volumeId: number,
    body: { name: string; snapshot_id: number; vm_id: number }
  ): Promise<{ message: string }>;
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
  constructor(private readonly transport: ApiTransport) {}

  async attachVolumeToNode(
    volumeId: number,
    body: VolumeNodeActionRequest
  ): Promise<VolumeNodeActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Omit<VolumeNodeActionResult, 'message'>>
    >({
      body,
      method: 'PUT',
      path: buildAttachVolumePath(volumeId)
    });

    return mapVolumeNodeActionResponse(response);
  }

  async createSnapshot(
    volumeId: number,
    name: string
  ): Promise<{ message: string }> {
    const response = await this.transport.post(
      `${buildVolumePath(volumeId)}snapshot/`,
      { body: { name } }
    );

    return { message: response.message };
  }

  async deleteSnapshot(
    volumeId: number,
    snapshotId: string
  ): Promise<{ message: string }> {
    const response = await this.transport.delete(
      `${buildVolumePath(volumeId)}snapshot/${snapshotId}`
    );

    return { message: response.message };
  }

  async listSnapshots(volumeId: number): Promise<SnapshotApiItem[]> {
    const response = await this.transport.get<ApiEnvelope<SnapshotApiItem[]>>(
      `${buildVolumePath(volumeId)}snapshot/`
    );

    return response.data;
  }

  async resizeVolume(
    volumeId: number,
    body: { block_storage_size: number; name: string; vm_id: number }
  ): Promise<{ message: string }> {
    const response = await this.transport.request({
      body,
      method: 'PUT',
      path: `${buildVolumePath(volumeId)}vm/upgrade/`
    });

    return { message: response.message };
  }

  async saveSnapshotAsVolume(
    volumeId: number,
    body: { name: string; snapshot_id: number; vm_id: number }
  ): Promise<{ message: string }> {
    const response = await this.transport.request({
      body,
      method: 'PUT',
      path: `${buildVolumePath(volumeId)}restore/`
    });

    return { message: response.message };
  }

  async createVolume(body: VolumeCreateRequest): Promise<VolumeCreateResult> {
    const response = await this.transport.post<ApiEnvelope<VolumeCreateResult>>(
      BLOCK_STORAGE_PATH,
      {
        body
      }
    );

    return response.data;
  }

  async deleteVolume(volumeId: number): Promise<{ message: string }> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, unknown>>
    >(buildVolumePath(volumeId));

    return mapVolumeDeleteResponse(response);
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
      path: buildDetachVolumePath(volumeId)
    });

    return mapVolumeNodeActionResponse(response);
  }

  async getVolume(volumeId: number): Promise<VolumeDetails> {
    const response = await this.transport.get<ApiEnvelope<VolumeDetails>>(
      buildVolumePath(volumeId)
    );

    return response.data;
  }

  async listVolumePlans(): Promise<VolumePlan[]> {
    const response = await this.transport.get<ApiEnvelope<VolumePlan[]>>(
      BLOCK_STORAGE_PLANS_PATH
    );

    return response.data;
  }

  async listVolumes(
    pageNumber: number,
    perPage: number
  ): Promise<VolumeListResult> {
    const response = await this.transport.get<VolumeListApiResponse>(
      BLOCK_STORAGE_PATH,
      {
        query: {
          page_no: String(pageNumber),
          per_page: String(perPage)
        }
      }
    );

    return mapVolumeListResponse(response);
  }
}

function buildVolumePath(volumeId: number): string {
  return `${BLOCK_STORAGE_PATH}${volumeId}/`;
}

function buildAttachVolumePath(volumeId: number): string {
  return `${buildVolumePath(volumeId)}vm/attach/`;
}

function buildDetachVolumePath(volumeId: number): string {
  return `${buildVolumePath(volumeId)}vm/detach/`;
}

function mapVolumeDeleteResponse(
  response: ApiEnvelope<Record<string, unknown>>
): { message: string } {
  return {
    message: response.message
  };
}

function mapVolumeNodeActionResponse(
  response: ApiEnvelope<Omit<VolumeNodeActionResult, 'message'>>
): VolumeNodeActionResult {
  return {
    message: response.message,
    ...response.data
  };
}

function mapVolumeListResponse(
  response: VolumeListApiResponse
): VolumeListResult {
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
