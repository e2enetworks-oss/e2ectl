import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDeleteResult,
  NodeDetails,
  NodeListResult,
  NodeSummary
} from './types.js';

type NodeListApiResponse = ApiResponse<
  NodeSummary[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

export interface NodeClient {
  createNode(body: NodeCreateRequest): Promise<NodeCreateResult>;
  deleteNode(nodeId: string): Promise<NodeDeleteResult>;
  getNode(nodeId: string): Promise<NodeDetails>;
  listNodeCatalogOs(): Promise<NodeCatalogOsData>;
  listNodeCatalogPlans(query: NodeCatalogQuery): Promise<NodeCatalogPlan[]>;
  listNodes(): Promise<NodeListResult>;
}

export class NodeApiClient implements NodeClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createNode(body: NodeCreateRequest): Promise<NodeCreateResult> {
    const response = await this.transport.post<ApiEnvelope<NodeCreateResult>>(
      '/nodes/',
      {
        body
      }
    );

    return response.data;
  }

  async deleteNode(nodeId: string): Promise<NodeDeleteResult> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, never>>
    >(`/nodes/${nodeId}/`);

    return {
      message: response.message
    };
  }

  async getNode(nodeId: string): Promise<NodeDetails> {
    const response = await this.transport.get<ApiEnvelope<NodeDetails>>(
      `/nodes/${nodeId}/`
    );

    return response.data;
  }

  async listNodeCatalogOs(): Promise<NodeCatalogOsData> {
    const response = await this.transport.get<ApiEnvelope<NodeCatalogOsData>>(
      '/images/os-category/'
    );

    return response.data;
  }

  async listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<NodeCatalogPlan[]> {
    const response = await this.transport.get<ApiEnvelope<NodeCatalogPlan[]>>(
      '/images/',
      {
        query
      }
    );

    return response.data;
  }

  async listNodes(): Promise<NodeListResult> {
    const response = await this.transport.get<NodeListApiResponse>('/nodes/');

    return {
      nodes: response.data,
      ...(response.total_count === undefined
        ? {}
        : { total_count: response.total_count }),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
  }
}
