import { stableStringify } from '../../../src/core/json.js';
import { renderProjectResult } from '../../../src/project/formatter.js';

describe('renderProjectResult', () => {
  it('renders deterministic json and useful human output for project lists', () => {
    const result = {
      action: 'list' as const,
      items: [
        {
          is_cli_default_project: false,
          is_default: false,
          is_starred: true,
          name: 'zeta-project',
          project_id: 50001
        },
        {
          is_cli_default_project: true,
          is_default: true,
          is_starred: false,
          name: 'default-project',
          project_id: 46429
        }
      ]
    };

    expect(renderProjectResult(result, false)).toContain('default-project');
    expect(
      renderProjectResult(result, false).indexOf('default-project')
    ).toBeLessThan(renderProjectResult(result, false).indexOf('zeta-project'));
    expect(renderProjectResult(result, false)).toContain('CLI Default');
    expect(renderProjectResult(result, true)).toBe(
      `${stableStringify({
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
            name: 'zeta-project',
            project_id: 50001
          }
        ]
      })}\n`
    );
  });

  it('renders json and human output for project create', () => {
    const result = {
      action: 'create' as const,
      name: 'new-project',
      project_id: 99001
    };

    expect(renderProjectResult(result, false)).toBe(
      'Created project: new-project\nID: 99001\n'
    );
    expect(renderProjectResult(result, true)).toBe(
      `${stableStringify({
        action: 'create',
        name: 'new-project',
        project_id: 99001
      })}\n`
    );
  });

  it('renders json and human output for project star', () => {
    const result = {
      action: 'star' as const,
      name: 'my-project',
      project_id: 46429
    };

    expect(renderProjectResult(result, false)).toBe(
      'Starred project: my-project\nID: 46429\n'
    );
    expect(renderProjectResult(result, true)).toBe(
      `${stableStringify({ action: 'star', name: 'my-project', project_id: 46429 })}\n`
    );
  });

  it('renders json and human output for project unstar', () => {
    const result = {
      action: 'unstar' as const,
      name: 'my-project',
      project_id: 46429
    };

    expect(renderProjectResult(result, false)).toBe(
      'Unstarred project: my-project\nID: 46429\n'
    );
    expect(renderProjectResult(result, true)).toBe(
      `${stableStringify({ action: 'unstar', name: 'my-project', project_id: 46429 })}\n`
    );
  });

  it('renders a clear empty state for project lists', () => {
    expect(
      renderProjectResult(
        {
          action: 'list',
          items: []
        },
        false
      )
    ).toBe('No projects found.\n');
  });
});
