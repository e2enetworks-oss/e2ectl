import {
  formatSshKeyTable,
  renderSshKeyResult
} from '../../../src/ssh-key/formatter.js';

describe('ssh-key formatter', () => {
  it('renders stable SSH key tables', () => {
    const table = formatSshKeyTable([
      {
        attached_nodes: 2,
        created_at: '19-Feb-2025',
        id: 15398,
        label: 'demo',
        project_id: null,
        project_name: 'default-project',
        public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
        type: 'ED25519'
      }
    ]);

    expect(table).toContain('demo');
    expect(table).toContain('ED25519');
    expect(table).toContain('15398');
  });

  it('renders SSH key create output for humans', () => {
    const output = renderSshKeyResult(
      {
        action: 'create',
        item: {
          attached_nodes: 0,
          created_at: '19-Feb-2025',
          id: 15398,
          label: 'demo',
          project_id: '46429',
          project_name: null,
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
          type: 'ED25519'
        }
      },
      false
    );

    expect(output).toContain('Added SSH key: demo');
    expect(output).toContain('Type: ED25519');
  });
});
