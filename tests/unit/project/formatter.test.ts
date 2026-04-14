import { stableStringify } from '../../../src/core/json.js';
import { renderProjectResult } from '../../../src/project/formatter.js';

describe('renderProjectResult', () => {
  it('renders deterministic json and useful human output for project lists', () => {
    const result = {
      action: 'list' as const,
      items: [
        {
          associated_member_count: 2,
          associated_policy_count: 1,
          current_user_role: 'Admin',
          is_backend_active_project: false,
          is_cli_default_project: false,
          is_default: false,
          is_starred: true,
          name: 'zeta-project',
          project_id: 50001
        },
        {
          associated_member_count: 1,
          associated_policy_count: 2,
          current_user_role: 'Owner',
          is_backend_active_project: true,
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
            associated_member_count: 1,
            associated_policy_count: 2,
            current_user_role: 'Owner',
            is_backend_active_project: true,
            is_cli_default_project: true,
            is_default: true,
            is_starred: false,
            name: 'default-project',
            project_id: 46429
          },
          {
            associated_member_count: 2,
            associated_policy_count: 1,
            current_user_role: 'Admin',
            is_backend_active_project: false,
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
