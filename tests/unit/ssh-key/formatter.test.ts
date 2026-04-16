import {
  formatSshKeyTable,
  renderSshKeyResult
} from '../../../src/ssh-key/formatter.js';
import { stableStringify } from '../../../src/core/json.js';

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

  it('renders SSH key detail output for humans', () => {
    const output = renderSshKeyResult(
      {
        action: 'get',
        item: {
          attached_nodes: 2,
          created_at: '19-Feb-2025',
          id: 15398,
          label: 'demo',
          project_id: '46429',
          project_name: 'default-project',
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
          type: 'ED25519'
        }
      },
      false
    );

    expect(output).toContain('Label: demo');
    expect(output).toContain('Attached Nodes: 2');
    expect(output).toContain('Project: default-project');
    expect(output).toContain('Public Key: ssh-ed25519');
  });

  it('renders empty lists and cancelled deletes predictably', () => {
    const emptyListOutput = renderSshKeyResult(
      {
        action: 'list',
        items: []
      },
      false
    );
    const cancelledDeleteJson = renderSshKeyResult(
      {
        action: 'delete',
        cancelled: true,
        id: 15398
      },
      true
    );

    expect(emptyListOutput).toBe('No SSH keys found.\n');
    expect(cancelledDeleteJson).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: true,
        id: 15398
      })}\n`
    );
  });
});
