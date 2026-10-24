import { createProgram } from '../../../../src/app/program.js';
import type { ProfileConfig } from '../../../../src/config/index.js';
import { ConfigStore } from '../../../../src/config/store.js';
import { CliError } from '../../../../src/core/errors.js';
import type { ProjectClient } from '../../../../src/myaccount/project/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const PROJECTS: ProjectClient = {
  createProject: vi.fn(),
  listProjects: () =>
    Promise.resolve([
      {
        is_default: true,
        is_starred: false,
        name: 'default-project',
        project_id: 46
      }
    ]),
  starUnstarProject: vi.fn()
};

async function run(
  args: string[],
  profile: Partial<ProfileConfig> = {},
  interactive?: { answers: string[] }
): Promise<{ output: string; store: ConfigStore }> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('myaccount-configure')
  });
  await store.upsertProfile('work', {
    api_key: 'k',
    auth_token: 't',
    ...profile
  });
  const stdout = new MemoryWriter();
  const answers = [...(interactive?.answers ?? [])];
  await createProgram(
    createTestRuntime({
      createProjectClient: () => PROJECTS,
      isInteractive: interactive !== undefined,
      prompt: () => Promise.resolve(answers.shift() ?? ''),
      stdout,
      store
    })
  ).parseAsync(['node', 'e2ectl', ...args]);
  return { output: stdout.buffer, store };
}

describe('myaccount configure', () => {
  it('saves the MyAccount project and location from flags', async () => {
    const { output, store } = await run(
      ['myaccount', 'configure', '--project-id', '46', '--location', 'Chennai'],
      { tir: { account_id: '1' } }
    );

    expect(output).toBe(
      'MyAccount context saved for profile "work": project 46 (default-project), Chennai.\n'
    );
    const saved = (await store.read()).profiles.work;
    expect(saved).toMatchObject({
      default_location: 'Chennai',
      default_project_id: '46'
    });
    expect(saved?.tir).toEqual({ account_id: '1' });
  });

  it('emits the same --json shape as tir configure', async () => {
    const { output } = await run([
      '--json',
      'myaccount',
      'configure',
      '--project-id',
      '46',
      '--location',
      'Delhi'
    ]);

    expect(JSON.parse(output)).toEqual({
      account: null,
      action: 'configure',
      alias: 'work',
      location: 'Delhi',
      platform: 'myaccount',
      project: { id: 46, name: 'default-project' }
    });
  });

  it('asks in a terminal, project first, then location', async () => {
    const { output } = await run(
      ['myaccount', 'configure'],
      {},
      { answers: ['', 'Delhi'] }
    );

    expect(output).toContain('MyAccount projects:');
    expect(output).toContain('46  default-project');
    expect(output).toContain('project 46 (default-project), Delhi.');
  });

  it.each([
    [['--location', 'Delhi'], 'No MyAccount project given.'],
    [
      ['--project-id', '99', '--location', 'Delhi'],
      'MyAccount project 99 was not found.'
    ],
    [
      ['--project-id', '46', '--location', 'Mumbai'],
      'Unsupported location "Mumbai".'
    ]
  ])('refuses %o with a next step', async (flags, message) => {
    const error = await run(['myaccount', 'configure', ...flags]).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toBe(message);
    expect((error as CliError).suggestion).toBeDefined();
  });
});
