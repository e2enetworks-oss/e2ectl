import type {
  ConfigFile,
  ResolvedAccountCredentials
} from '../../../src/config/index.js';
import { ProjectService } from '../../../src/project/service.js';
import type { ProjectClient } from '../../../src/project/index.js';

function createConfig(overrides?: {
  defaultLocation?: string;
  defaultProjectId?: string;
}): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        ...(overrides?.defaultLocation === undefined
          ? {}
          : { default_location: overrides.defaultLocation }),
        ...(overrides?.defaultProjectId === undefined
          ? {}
          : { default_project_id: overrides.defaultProjectId })
      }
    }
  };
}

function sampleProjects() {
  return [
    {
      associated_members: [
        {
          email: 'owner@example.com',
          iam_type: 'member',
          policies: [{ policy_id: 1, policy_name: 'Admin' }],
          role: 'Owner'
        }
      ],
      associated_policies: [
        {
          id: 11,
          policy_name: 'Admin',
          policy_set_type: 'custom'
        }
      ],
      current_user_role: 'Owner',
      is_active_project: true,
      is_default: true,
      is_starred: false,
      name: 'default-project',
      project_id: 46429
    },
    {
      associated_members: [],
      associated_policies: [],
      current_user_role: 'Member',
      is_active_project: false,
      is_default: false,
      is_starred: true,
      name: 'sandbox',
      project_id: 46430
    }
  ];
}

function createServiceFixture(config: ConfigFile) {
  const listProjects = vi.fn(() => Promise.resolve(sampleProjects()));
  let credentials: ResolvedAccountCredentials | undefined;

  const client: ProjectClient = {
    listProjects
  };

  const service = new ProjectService({
    createProjectClient: (resolvedCredentials) => {
      credentials = resolvedCredentials;
      return client;
    },
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(config)
    }
  });

  return {
    listProjects,
    receivedCredentials: () => credentials,
    service
  };
}

describe('ProjectService', () => {
  it('lists projects with account-scoped auth and marks the CLI default project when context exists', async () => {
    const { receivedCredentials, service } = createServiceFixture(
      createConfig({
        defaultLocation: 'Delhi',
        defaultProjectId: '46429'
      })
    );

    const result = await service.listProjects({ alias: 'prod' });

    expect(receivedCredentials()).toEqual({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token',
      location: 'Delhi',
      project_id: '46429',
      source: 'profile'
    });
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          associated_member_count: 1,
          associated_policy_count: 1,
          current_user_role: 'Owner',
          is_backend_active_project: true,
          is_cli_default_project: true,
          is_default: true,
          is_starred: false,
          name: 'default-project',
          project_id: 46429
        },
        {
          associated_member_count: 0,
          associated_policy_count: 0,
          current_user_role: 'Member',
          is_backend_active_project: false,
          is_cli_default_project: false,
          is_default: false,
          is_starred: true,
          name: 'sandbox',
          project_id: 46430
        }
      ]
    });
  });

  it('still works when the selected alias has no saved project or location defaults', async () => {
    const { receivedCredentials, service } =
      createServiceFixture(createConfig());

    const result = await service.listProjects({ alias: 'prod' });

    expect(receivedCredentials()).toEqual({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token',
      source: 'profile'
    });
    expect(result.items[0]?.is_cli_default_project).toBe(false);
  });
});
