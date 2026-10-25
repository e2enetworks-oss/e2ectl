// API quirks:
// - Every call takes project_id and location like other MyAccount calls.
// - A bucket is created with POST to its own name; deleting it empties it
//   first and finishes in the background.
// - Access keys live under /storage/core/; one is deleted by access key in
//   the query, not by id in the path.
// - Bucket access takes the key's internal id and the role's display name,
//   and only adds: granting one key never removes another.
// - Key lists and access lists include each key's secret_key.
// - Deleting a key answers with errors as text ("") instead of an object,
//   so that reply is read directly rather than as the usual envelope.
import { isRecord } from '../../core/guards.js';
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type {
  EosAccessApiItem,
  EosBucketApiItem,
  EosCreatedKeyApiItem,
  EosKeyApiItem
} from './types.js';

const BUCKETS_PATH = '/storage/buckets/';
const KEYS_PATH = '/storage/core/users/';
const KEY_LIST_PATH = '/storage/core/list/users/';
const ACCESS_PATH = '/storage/bucket_perms/';

export interface EosClient {
  createBucket(name: string): Promise<EosBucketApiItem>;
  createKey(name: string): Promise<EosCreatedKeyApiItem>;
  deleteBucket(name: string): Promise<{ message: string }>;
  deleteKey(accessKey: string): Promise<{ message: string }>;
  grantAccess(
    bucket: string,
    body: { role_name: string; users: Array<{ id: number }> }
  ): Promise<EosAccessApiItem[]>;
  listAccess(bucket: string): Promise<EosAccessApiItem[]>;
  listBuckets(): Promise<EosBucketApiItem[]>;
  listKeys(): Promise<EosKeyApiItem[]>;
  revokeAccess(bucket: string, accessId: number): Promise<{ message: string }>;
}

export class EosApiClient implements EosClient {
  constructor(private readonly transport: ApiTransport) {}

  async createBucket(name: string): Promise<EosBucketApiItem> {
    const response = await this.transport.post<ApiEnvelope<EosBucketApiItem>>(
      `${BUCKETS_PATH}${encodeURIComponent(name)}/`,
      { body: {} }
    );

    return response.data;
  }

  async createKey(name: string): Promise<EosCreatedKeyApiItem> {
    const response = await this.transport.post<
      ApiEnvelope<EosCreatedKeyApiItem>
    >(KEYS_PATH, { body: { tag: name } });

    return response.data;
  }

  async deleteBucket(name: string): Promise<{ message: string }> {
    const response = await this.transport.delete(
      `${BUCKETS_PATH}${encodeURIComponent(name)}/`
    );

    return { message: response.message };
  }

  async deleteKey(accessKey: string): Promise<{ message: string }> {
    return await this.transport.delete(KEYS_PATH, {
      parseResponse: (payload) => ({
        message:
          isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : ''
      }),
      query: { access_key: accessKey }
    });
  }

  async grantAccess(
    bucket: string,
    body: { role_name: string; users: Array<{ id: number }> }
  ): Promise<EosAccessApiItem[]> {
    const response = await this.transport.request<
      ApiEnvelope<EosAccessApiItem[]>
    >({
      body,
      method: 'PUT',
      path: ACCESS_PATH,
      query: { bucket_name: bucket }
    });

    return response.data;
  }

  async listAccess(bucket: string): Promise<EosAccessApiItem[]> {
    const response = await this.transport.get<ApiEnvelope<EosAccessApiItem[]>>(
      ACCESS_PATH,
      { query: { bucket_name: bucket } }
    );

    return response.data;
  }

  async listBuckets(): Promise<EosBucketApiItem[]> {
    const response =
      await this.transport.get<ApiEnvelope<EosBucketApiItem[]>>(BUCKETS_PATH);

    return response.data;
  }

  async listKeys(): Promise<EosKeyApiItem[]> {
    const response =
      await this.transport.get<ApiEnvelope<EosKeyApiItem[]>>(KEY_LIST_PATH);

    return response.data;
  }

  async revokeAccess(
    bucket: string,
    accessId: number
  ): Promise<{ message: string }> {
    const response = await this.transport.delete(
      `/storage/bucket_perm/${accessId}/`,
      { query: { bucket_name: bucket } }
    );

    return { message: response.message };
  }
}
