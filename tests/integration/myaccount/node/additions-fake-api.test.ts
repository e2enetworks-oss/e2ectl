import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../../helpers/config-fixtures.js';
import {
  startTestHttpServer,
  type HttpRouteHandler
} from '../../../helpers/http-server.js';
import { runBuiltCli } from '../../../helpers/process.js';
import { createTempHome } from '../../../helpers/temp-home.js';

const API = '/myaccount/api/v1';

function ok(data: unknown): ReturnType<HttpRouteHandler> {
  return { body: { code: 200, data, errors: {}, message: 'OK' } };
}

const NODE = {
  id: 101,
  is_accidental_protection: true,
  name: 'e2ectl-test-node',
  os_info: { category: 'Linux Virtual Node', name: 'Ubuntu', version: '24.04' },
  plan: 'C3.8GB',
  status: 'Running',
  vm_id: 9
};

async function runAgainst(
  handlers: Record<string, HttpRouteHandler>,
  args: string[]
) {
  const server = await startTestHttpServer(handlers);
  const tempHome = await createTempHome();

  try {
    await seedDefaultProfile(tempHome);
    const result = await runBuiltCli(args, {
      env: {
        HOME: tempHome.path,
        [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}${API}`
      }
    });
    return { ...result, requests: server.requests };
  } finally {
    await server.close();
    await tempHome.cleanup();
  }
}

describe('node additions against a fake MyAccount API', () => {
  it.each([
    ['reboot', 'reboot'],
    ['protect', 'enable_accidental_protection'],
    ['unprotect', 'disable_accidental_protection']
  ])('sends node action %s as %s', async (command, type) => {
    const result = await runAgainst(
      {
        [`PUT ${API}/nodes/101/actions/`]: () =>
          ok({
            action_type: type,
            created_at: '2026-10-25T10:00:00Z',
            id: 5,
            resource_id: '101',
            status: 'Done'
          })
      },
      ['--json', 'myaccount', 'node', 'action', command, '101']
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      action: command,
      node_id: 101
    });
    expect(JSON.parse(result.requests[0]?.body ?? '{}')).toEqual({ type });
  });

  it('create --wait returns the running node', async () => {
    const result = await runAgainst(
      {
        [`POST ${API}/nodes/`]: () =>
          ok({
            node_create_response: [{ ...NODE, status: 'Creating' }],
            total_number_of_node_created: 1,
            total_number_of_node_requested: 1
          }),
        [`GET ${API}/nodes/101/`]: () => ok(NODE)
      },
      [
        '--json',
        'myaccount',
        'node',
        'create',
        '--name',
        'e2ectl-test-node',
        '--plan',
        'C3-4vCPU-8RAM',
        '--image',
        'Ubuntu-24.04-Distro',
        '--wait'
      ]
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      created: 1,
      node: { id: 101, status: 'Running' }
    });
  });

  it('upgrade without --image keeps the image the node runs', async () => {
    const result = await runAgainst(
      {
        [`GET ${API}/nodes/101/`]: () => ok(NODE),
        [`GET ${API}/images/category-list/`]: () =>
          ok({
            category_list: {
              'Linux Virtual Node': {
                Ubuntu: [
                  { os: 'Ubuntu', sub_category: 'Ubuntu', version: '24.04' }
                ]
              }
            }
          }),
        [`GET ${API}/images/`]: () =>
          ok([
            {
              image: 'Ubuntu-24.04-Distro',
              name: 'C3.16GB',
              plan: 'C3-8vCPU-16RAM'
            }
          ]),
        [`PUT ${API}/nodes/upgrade/101`]: () =>
          ok({ location: 'Delhi', vm_id: 9 })
      },
      [
        '--json',
        'myaccount',
        'node',
        'upgrade',
        '101',
        '--plan',
        'C3-8vCPU-16RAM',
        '--force'
      ]
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      image_kept: true,
      requested: { image: 'Ubuntu-24.04-Distro', plan: 'C3-8vCPU-16RAM' }
    });
    const upgrade = result.requests.find((request) => request.method === 'PUT');
    expect(JSON.parse(upgrade?.body ?? '{}')).toEqual({
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-8vCPU-16RAM'
    });
  });

  it('catalog plans filters GPU plans by card, vCPU and RAM', async () => {
    const result = await runAgainst(
      {
        [`GET ${API}/images/`]: () =>
          ok([
            {
              gpu_card_details: {
                CARD_TYPE: 'Nvidia-T4',
                MEMORY: '16',
                UNIT_COUNT: 1
              },
              image: 'Ubuntu-24.04-GPU',
              name: 'GDC.T4-12.50GB',
              plan: 't4',
              specs: { cpu: 12, family: 'GPU', ram: '50.00' }
            },
            {
              gpu_card_details: {
                CARD_TYPE: 'Nvidia-A100',
                MEMORY: '80',
                UNIT_COUNT: 1
              },
              image: 'Ubuntu-24.04-GPU',
              name: 'GDC.A100',
              plan: 'a100',
              specs: { cpu: 16, family: 'GPU', ram: '115.00' }
            }
          ])
      },
      [
        '--json',
        'myaccount',
        'node',
        'catalog',
        'plans',
        '--display-category',
        'GPU',
        '--category',
        'Gpu',
        '--os',
        'Ubuntu',
        '--os-version',
        '24.04',
        '--gpu-type',
        'T4',
        '--min-vcpu',
        '8',
        '--min-ram',
        '32'
      ]
    );

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout) as {
      items: { config: { gpu: unknown }; plan: string }[];
      query: Record<string, unknown>;
    };
    expect(output.items.map((item) => item.plan)).toEqual(['t4']);
    expect(output.items[0]?.config.gpu).toEqual({
      count: 1,
      memory_gb: 16,
      type: 'Nvidia-T4'
    });
    expect(output.query).toMatchObject({
      gpu_type: 'T4',
      min_ram_gb: 32,
      min_vcpu: 8
    });
  });
});
