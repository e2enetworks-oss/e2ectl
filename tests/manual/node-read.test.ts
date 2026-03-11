import { MyAccountApiClient } from '../../src/client/api.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;
const itWithNodeId = process.env.E2ECTL_MANUAL_NODE_ID ? it : it.skip;

interface ManualCredentials {
  api_key: string;
  auth_token: string;
  location: string;
  project_id: string;
  source: 'env';
}

describeManual('manual MyAccount read-only API checks', () => {
  it('lists OS catalog rows using the configured production credentials', async () => {
    const client = new MyAccountApiClient(readManualCredentials());
    const response = await client.listNodeCatalogOs();

    expect(response.code).toBe(200);
    expect(Array.isArray(response.data.category_list)).toBe(true);
    expect(response.data.category_list.length).toBeGreaterThan(0);
  });

  it('lists plan and image pairs for the first available OS catalog row', async () => {
    const client = new MyAccountApiClient(readManualCredentials());
    const osCatalog = await client.listNodeCatalogOs();
    const group = osCatalog.data.category_list[0];
    const version = group?.version[0];
    const displayCategory = group?.category[0];

    expect(group).toBeDefined();
    expect(version).toBeDefined();
    expect(displayCategory).toBeDefined();

    const response = await client.listNodeCatalogPlans({
      category: version!.sub_category,
      display_category: displayCategory!,
      os: version!.os,
      osversion: version!.version
    });

    expect(response.code).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('lists nodes using the configured production credentials', async () => {
    const client = new MyAccountApiClient(readManualCredentials());
    const response = await client.listNodes();

    expect(response.code).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  itWithNodeId(
    'reads a specific node when E2ECTL_MANUAL_NODE_ID is provided',
    async () => {
      const client = new MyAccountApiClient(readManualCredentials());
      const response = await client.getNode(process.env.E2ECTL_MANUAL_NODE_ID!);

      expect(response.code).toBe(200);
      expect(String(response.data.id)).toBe(process.env.E2ECTL_MANUAL_NODE_ID);
    }
  );
});

function readManualCredentials(): ManualCredentials {
  const apiKey = process.env.E2E_API_KEY;
  const authToken = process.env.E2E_AUTH_TOKEN;
  const projectId = process.env.E2E_PROJECT_ID;
  const location = process.env.E2E_LOCATION;

  if (
    apiKey === undefined ||
    authToken === undefined ||
    projectId === undefined ||
    location === undefined
  ) {
    throw new Error(
      'Manual e2e tests require E2E_API_KEY, E2E_AUTH_TOKEN, E2E_PROJECT_ID, and E2E_LOCATION.'
    );
  }

  return {
    api_key: apiKey,
    auth_token: authToken,
    location,
    project_id: projectId,
    source: 'env'
  };
}
