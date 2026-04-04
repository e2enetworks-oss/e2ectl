import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  NodeActionRequest,
  NodeActionResult,
  NodeActionSshKey,
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDeleteResult,
  NodeDetails,
  NodeListResult,
  NodeSummary,
  NodeUpgradeRequest,
  NodeUpgradeResult
} from './types.js';

type NodeListApiResponse = ApiResponse<
  NodeSummary[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

const NODES_PATH = '/nodes/';
const NODE_CATALOG_OS_PATH = '/images/os-category/';
const NODE_CATALOG_PLANS_PATH = '/images/';

export type NodeDeleteQuery = Record<'reserve_ip_required', 'true'>;

export interface NodeClient {
  attachSshKeys(
    nodeId: string,
    sshKeys: NodeActionSshKey[]
  ): Promise<NodeActionResult>;
  createNode(body: NodeCreateRequest): Promise<NodeCreateResult>;
  deleteNode(
    nodeId: string,
    query?: NodeDeleteQuery
  ): Promise<NodeDeleteResult>;
  getNode(nodeId: string): Promise<NodeDetails>;
  listNodeCatalogOs(): Promise<NodeCatalogOsData>;
  listNodeCatalogPlans(query: NodeCatalogQuery): Promise<NodeCatalogPlan[]>;
  listNodes(): Promise<NodeListResult>;
  powerOffNode(nodeId: string): Promise<NodeActionResult>;
  powerOnNode(nodeId: string): Promise<NodeActionResult>;
  saveNodeImage(nodeId: string, name: string): Promise<NodeActionResult>;
  upgradeNode(
    nodeId: string,
    body: NodeUpgradeRequest
  ): Promise<NodeUpgradeResult>;
}

export class NodeApiClient implements NodeClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachSshKeys(
    nodeId: string,
    sshKeys: NodeActionSshKey[]
  ): Promise<NodeActionResult> {
    return await this.runNodeAction(nodeId, {
      ssh_keys: sshKeys,
      type: 'add_ssh_keys'
    });
  }

  async createNode(body: NodeCreateRequest): Promise<NodeCreateResult> {
    const response = await this.transport.post<ApiEnvelope<NodeCreateResult>>(
      NODES_PATH,
      {
        body
      }
    );

    return response.data;
  }

  async deleteNode(
    nodeId: string,
    query?: NodeDeleteQuery
  ): Promise<NodeDeleteResult> {
    const response = await this.transport.delete<
      ApiEnvelope<Record<string, never>>
    >(buildNodePath(nodeId), query === undefined ? undefined : { query });

    return mapNodeDeleteResponse(response);
  }

  async getNode(nodeId: string): Promise<NodeDetails> {
    const response = await this.transport.get<ApiEnvelope<NodeDetails>>(
      buildNodePath(nodeId)
    );

    return response.data;
  }

  async listNodeCatalogOs(): Promise<NodeCatalogOsData> {
    const response =
      await this.transport.get<ApiEnvelope<NodeCatalogOsData>>(
        NODE_CATALOG_OS_PATH
      );

    return response.data;
  }

  async listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<NodeCatalogPlan[]> {
    const response = await this.transport.get<ApiEnvelope<NodeCatalogPlan[]>>(
      NODE_CATALOG_PLANS_PATH,
      {
        query
      }
    );

    return response.data;
  }

  async listNodes(): Promise<NodeListResult> {
    const response = await this.transport.get<NodeListApiResponse>(NODES_PATH);

    return mapNodeListResponse(response);
  }

  async powerOffNode(nodeId: string): Promise<NodeActionResult> {
    return await this.runNodeAction(nodeId, {
      type: 'power_off'
    });
  }

  async powerOnNode(nodeId: string): Promise<NodeActionResult> {
    return await this.runNodeAction(nodeId, {
      type: 'power_on'
    });
  }

  async saveNodeImage(nodeId: string, name: string): Promise<NodeActionResult> {
    return await this.runNodeAction(nodeId, {
      name,
      type: 'save_images'
    });
  }

  async upgradeNode(
    nodeId: string,
    body: NodeUpgradeRequest
  ): Promise<NodeUpgradeResult> {
    const response = await this.transport.request<
      ApiEnvelope<Omit<NodeUpgradeResult, 'message'>>
    >({
      body,
      method: 'PUT',
      path: buildNodeUpgradePath(nodeId)
    });

    return mapNodeUpgradeResponse(response);
  }

  private async runNodeAction(
    nodeId: string,
    body: NodeActionRequest
  ): Promise<NodeActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<NodeActionResult>
    >({
      body,
      method: 'PUT',
      path: buildNodeActionPath(nodeId)
    });

    return response.data;
  }
}

function buildNodePath(nodeId: string): string {
  return `${NODES_PATH}${nodeId}/`;
}

function buildNodeActionPath(nodeId: string): string {
  return `${buildNodePath(nodeId)}actions/`;
}

function buildNodeUpgradePath(nodeId: string): string {
  return `${NODES_PATH}upgrade/${nodeId}`;
}

function mapNodeDeleteResponse(
  response: ApiEnvelope<Record<string, never>>
): NodeDeleteResult {
  return {
    message: response.message
  };
}

function mapNodeUpgradeResponse(
  response: ApiEnvelope<Omit<NodeUpgradeResult, 'message'>>
): NodeUpgradeResult {
  return {
    location: response.data.location ?? null,
    message: response.message,
    new_node_image_id: response.data.new_node_image_id ?? null,
    old_node_image_id: response.data.old_node_image_id ?? null,
    vm_id: response.data.vm_id ?? null
  };
}

function mapNodeListResponse(response: NodeListApiResponse): NodeListResult {
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
