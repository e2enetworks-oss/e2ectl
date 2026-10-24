import { TirAccountApiClient } from '../../../src/tir/account/client.js';
import { TirImageApiClient } from '../../../src/tir/image/client.js';
import { TirPlanApiClient } from '../../../src/tir/plan/client.js';
import { TirProjectApiClient } from '../../../src/tir/project/client.js';
import { createStubTransport } from '../../helpers/stub-transport.js';

describe('TIR API clients', () => {
  it('lists accounts without a project context', async () => {
    const { calls, transport } = createStubTransport();
    await new TirAccountApiClient(transport).listAccounts();

    expect(calls).toEqual([
      {
        method: 'GET',
        options: { includeProjectContext: false },
        path: '/users/iam-accounts/'
      }
    ]);
  });

  it('lists projects of one account', async () => {
    const { calls, transport } = createStubTransport();
    await new TirProjectApiClient(transport).listProjects('11');

    expect(calls).toEqual([
      {
        method: 'GET',
        options: { includeProjectContext: false, query: { active_iam: '11' } },
        path: '/projects/'
      }
    ]);
  });

  it('lists container images with their versions', async () => {
    const { calls, transport } = createStubTransport();
    await new TirImageApiClient(transport).listImages();

    expect(calls[0]).toMatchObject({
      options: {
        query: {
          category: 'notebook',
          is_advanced_search: 'true',
          not_app_name: 'vm'
        }
      },
      path: '/gpu_service/image/'
    });
  });

  it('lists plans, for one image version when given', async () => {
    const { calls, transport } = createStubTransport({});
    const client = new TirPlanApiClient(transport);
    await client.listPlans();
    await client.listPlans(42);

    expect(calls.map((call) => call.options)).toEqual([
      { query: { image_version_id: undefined, service: 'notebook' } },
      { query: { image_version_id: '42', service: 'notebook' } }
    ]);
  });
});
