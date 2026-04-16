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
      is_default: true,
      is_starred: false,
      name: 'default-project',
      project_id: 46429
    },
    {
      is_default: false,
      is_starred: true,
      name: 'sandbox',
      project_id: 46430
    }
  ];
}

function createServiceFixture(config: ConfigFile) {
  const listProjects = vi.fn(() => Promise.resolve(sampleProjects()));
  const createProject = vi.fn(() =>
    Promise.resolve({ project_id: 99001, project_name: 'new-project' })
  );
  const starUnstarProject = vi.fn(
    (body: { is_starred: boolean; name: string; project_id: number }) =>
      Promise.resolve({
        project_id: body.project_id,
        project_name: body.name
      })
  );
  let credentials: ResolvedAccountCredentials | undefined;

  const client: ProjectClient = {
    createProject,
    listProjects,
    starUnstarProject
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
    createProject,
    listProjects,
    receivedCredentials: () => credentials,
    service,
    starUnstarProject
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
          is_cli_default_project: true,
          is_default: true,
          is_starred: false,
          name: 'default-project',
          project_id: 46429
        },
        {
          is_cli_default_project: false,
          is_default: false,
          is_starred: true,
          name: 'sandbox',
          project_id: 46430
        }
      ]
    });
  });

  it('creates a project and returns the result', async () => {
    const { createProject, receivedCredentials, service } =
      createServiceFixture(
        createConfig({
          defaultLocation: 'Delhi',
          defaultProjectId: '46429'
        })
      );

    const result = await service.createProject({
      alias: 'prod',
      name: 'new-project'
    });

    expect(createProject).toHaveBeenCalledWith({ name: 'new-project' });
    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      api_key: 'api-key',
      auth_token: 'auth-token'
    });
    expect(result).toEqual({
      action: 'create',
      name: 'new-project',
      project_id: 99001
    });
  });

  it('stars a project by looking up its name then sending a PUT', async () => {
    const { service, starUnstarProject } = createServiceFixture(
      createConfig({ defaultLocation: 'Delhi', defaultProjectId: '46429' })
    );

    const result = await service.starProject('46429', { alias: 'prod' });

    expect(starUnstarProject).toHaveBeenCalledWith({
      is_starred: true,
      name: 'default-project',
      project_id: 46429
    });
    expect(result).toEqual({
      action: 'star',
      name: 'default-project',
      project_id: 46429
    });
  });

  it('unstars a project by looking up its name then sending a PUT', async () => {
    const { service, starUnstarProject } = createServiceFixture(
      createConfig({ defaultLocation: 'Delhi', defaultProjectId: '46429' })
    );

    const result = await service.unstarProject('46430', { alias: 'prod' });

    expect(starUnstarProject).toHaveBeenCalledWith({
      is_starred: false,
      name: 'sandbox',
      project_id: 46430
    });
    expect(result).toEqual({
      action: 'unstar',
      name: 'sandbox',
      project_id: 46430
    });
  });

  it('rejects non-numeric project id for star', async () => {
    const { service } = createServiceFixture(
      createConfig({ defaultLocation: 'Delhi', defaultProjectId: '46429' })
    );

    await expect(service.starProject('abc', { alias: 'prod' })).rejects.toThrow(
      'Project ID must be numeric.'
    );
  });

  it('rejects an unsafe-large project id for star', async () => {
    const { service } = createServiceFixture(
      createConfig({ defaultLocation: 'Delhi', defaultProjectId: '46429' })
    );

    await expect(
      service.starProject('9007199254740992', { alias: 'prod' })
    ).rejects.toThrow('Project ID is too large to represent safely.');
  });

  it('rejects unknown project id for star', async () => {
    const { service } = createServiceFixture(
      createConfig({ defaultLocation: 'Delhi', defaultProjectId: '46429' })
    );

    await expect(
      service.starProject('99999', { alias: 'prod' })
    ).rejects.toThrow('Project 99999 was not found.');
  });

  it('rejects empty project name', async () => {
    const { service } = createServiceFixture(
      createConfig({
        defaultLocation: 'Delhi',
        defaultProjectId: '46429'
      })
    );

    await expect(
      service.createProject({ alias: 'prod', name: '   ' })
    ).rejects.toThrow('Name cannot be empty.');
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
