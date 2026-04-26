import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import {
  formatReservedIpListTable,
  renderReservedIpResult
} from '../../../src/reserved-ip/formatter.js';

function sampleReservedIpItem() {
  return {
    appliance_type: 'NODE',
    bought_at: '04-11-2024 10:37',
    floating_ip_attached_nodes: [
      {
        id: 101,
        ip_address_private: '10.0.0.5',
        ip_address_public: '164.52.198.55',
        name: 'node-a',
        security_group_status: 'Updated',
        status_name: 'Running',
        vm_id: 100157
      }
    ],
    ip_address: '164.52.198.54',
    project_name: 'default-project',
    reserve_id: 12662,
    reserved_type: 'AddonIP',
    status: 'Assigned',
    vm_id: 100157,
    vm_name: 'node-a'
  };
}

describe('reserved-ip formatter', () => {
  it('renders stable reserved IP list tables', () => {
    const table = formatReservedIpListTable([
      {
        ...sampleReservedIpItem(),
        ip_address: '216.48.184.202',
        reserve_id: 12663
      },
      sampleReservedIpItem()
    ]);

    expect(table).toContain('default-project');
    expect(table).toContain('AddonIP / NODE');
    expect(table).toContain('node-a (VM 100157)');
    expect(table.indexOf('164.52.198.54')).toBeLessThan(
      table.indexOf('216.48.184.202')
    );
  });

  it('renders reserved IP create output with explicit source metadata and next step', () => {
    const output = renderReservedIpResult(
      {
        action: 'create',
        reserved_ip: {
          ...sampleReservedIpItem(),
          status: 'Reserved',
          vm_id: null,
          vm_name: '--'
        },
        source: 'default-network'
      },
      false
    );

    expect(output).toContain('Created reserved IP: 164.52.198.54');
    expect(output).toContain('Source: default-network');
    expect(output).toContain(formatCliCommand('reserved-ip list'));
  });

  it('renders reserved IP details with floating attachment data', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: sampleReservedIpItem()
      },
      false
    );

    expect(output).toContain('Reserved IP: 164.52.198.54');
    expect(output).toContain('Floating Attached Nodes (1)');
    expect(output).toContain('node-a');
    expect(output).toContain('10.0.0.5');
  });

  it('renders reserved IP details without floating attachments', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: []
        }
      },
      false
    );

    expect(output).toContain('Reserved IP: 164.52.198.54');
    expect(output).toContain('Floating Attached Nodes: none');
  });

  it('renders addon attach output in human mode and reserve-node output in deterministic json mode', () => {
    const humanOutput = renderReservedIpResult(
      {
        action: 'attach-node',
        message: 'IP assigned successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      },
      false
    );
    const jsonOutput = renderReservedIpResult(
      {
        action: 'reserve-node',
        ip_address: '164.52.198.55',
        message: 'IP reserved successfully.',
        node_id: 101,
        status: 'Live Reserved'
      },
      true
    );

    expect(humanOutput).toContain(
      'Attached reserved IP 164.52.198.54 to node 101.'
    );
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'reserve-node',
        ip_address: '164.52.198.55',
        message: 'IP reserved successfully.',
        node_id: 101,
        status: 'Live Reserved'
      })}\n`
    );
  });

  it('renders reserve-node output for humans', () => {
    const output = renderReservedIpResult(
      {
        action: 'reserve-node',
        ip_address: '164.52.198.55',
        message: 'IP reserved successfully.',
        node_id: 101,
        status: 'Live Reserved'
      },
      false
    );

    expect(output).toContain(
      'Reserved current public IP 164.52.198.55 from node 101.'
    );
    expect(output).toContain('Status: Live Reserved');
    expect(output).toContain('Message: IP reserved successfully.');
  });

  it('renders attach, detach, get, and reserve output with fallback placeholders', () => {
    const attachOutput = renderReservedIpResult(
      {
        action: 'attach-node',
        message: 'IP assigned successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: null,
          vm_id: null,
          vm_name: null
        }
      },
      false
    );
    const detachOutput = renderReservedIpResult(
      {
        action: 'detach-node',
        message: 'IP detached successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: null,
          vm_id: null,
          vm_name: null
        }
      },
      false
    );
    const getOutput = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          bought_at: null,
          project_name: null,
          reserve_id: null,
          status: null
        }
      },
      false
    );
    const reserveOutput = renderReservedIpResult(
      {
        action: 'reserve-node',
        ip_address: '164.52.198.55',
        message: 'IP reserved successfully.',
        node_id: 101,
        status: null
      },
      false
    );

    expect(attachOutput).toContain('Status: --');
    expect(attachOutput).toContain('Attached VM: --');
    expect(detachOutput).toContain('Status: --');
    expect(detachOutput).toContain('Attached VM: --');
    expect(getOutput).toContain('Status: --');
    expect(getOutput).toContain('Project: --');
    expect(getOutput).toContain('Bought At: --');
    expect(getOutput).toContain('Reserve ID: --');
    expect(reserveOutput).toContain('Status: --');
  });

  it('renders attach-node output in deterministic json mode', () => {
    const output = renderReservedIpResult(
      {
        action: 'attach-node',
        message: 'IP assigned successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'attach-node',
        message: 'IP assigned successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Assigned',
          vm_id: 100157,
          vm_name: 'node-a'
        }
      })}\n`
    );
  });

  it('renders detach-node results for humans and deterministic json output', () => {
    const humanOutput = renderReservedIpResult(
      {
        action: 'detach-node',
        message: 'IP detached successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Reserved',
          vm_id: null,
          vm_name: null
        }
      },
      false
    );
    const jsonOutput = renderReservedIpResult(
      {
        action: 'detach-node',
        message: 'IP detached successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Reserved',
          vm_id: null,
          vm_name: null
        }
      },
      true
    );

    expect(humanOutput).toContain(
      'Detached reserved IP 164.52.198.54 from node 101.'
    );
    expect(humanOutput).toContain('Attached VM: --');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'detach-node',
        message: 'IP detached successfully.',
        node_id: 101,
        reserved_ip: {
          ip_address: '164.52.198.54',
          status: 'Reserved',
          vm_id: null,
          vm_name: null
        }
      })}\n`
    );
  });

  it('renders empty lists and delete flows predictably', () => {
    const emptyListOutput = renderReservedIpResult(
      {
        action: 'list',
        items: []
      },
      false
    );
    const cancelledDeleteOutput = renderReservedIpResult(
      {
        action: 'delete',
        cancelled: true,
        ip_address: '164.52.198.54'
      },
      false
    );
    const deletedJsonOutput = renderReservedIpResult(
      {
        action: 'delete',
        cancelled: false,
        ip_address: '164.52.198.54',
        message: 'IP Released 164.52.198.54'
      },
      true
    );

    expect(emptyListOutput).toBe('No reserved IPs found.\n');
    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
    expect(deletedJsonOutput).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        ip_address: '164.52.198.54',
        message: 'IP Released 164.52.198.54'
      })}\n`
    );
  });

  it('renders cancelled delete output in deterministic json mode', () => {
    const output = renderReservedIpResult(
      {
        action: 'delete',
        cancelled: true,
        ip_address: '164.52.198.54'
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: true,
        ip_address: '164.52.198.54'
      })}\n`
    );
  });

  it('renders deterministic json for reserved-ip creation', () => {
    const output = renderReservedIpResult(
      {
        action: 'create',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: [],
          status: 'Reserved',
          vm_id: null,
          vm_name: '--'
        },
        source: 'default-network'
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'create',
        reserved_ip: {
          appliance_type: 'NODE',
          bought_at: '04-11-2024 10:37',
          floating_ip_attached_nodes: [],
          ip_address: '164.52.198.54',
          project_name: 'default-project',
          reserve_id: 12662,
          reserved_type: 'AddonIP',
          status: 'Reserved',
          vm_id: null,
          vm_name: '--'
        },
        source: 'default-network'
      })}\n`
    );
  });

  it('renders reserved-ip details with fallback attached-vm and type labels', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          appliance_type: null,
          reserved_type: null,
          vm_id: null,
          vm_name: 'node-a'
        }
      },
      false
    );

    expect(output).toContain('Attached VM: node-a');
    expect(output).toContain('Type: --');
  });

  it('renders reserved-ip details with a type fallback from appliance only', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          appliance_type: 'NODE',
          reserved_type: null
        }
      },
      false
    );

    expect(output).toContain('Type: NODE');
  });

  it('renders reserved-ip details with a vm-id-only attachment label', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          vm_id: 100157,
          vm_name: null
        }
      },
      false
    );

    expect(output).toContain('Attached VM: VM 100157');
  });

  it('sorts floating attachment rows by node id and vm id', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: [
            {
              id: 205,
              ip_address_private: '10.0.0.7',
              ip_address_public: '164.52.198.99',
              name: 'node-z',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: 100200
            },
            {
              id: 101,
              ip_address_private: '10.0.0.5',
              ip_address_public: '164.52.198.55',
              name: 'node-a',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: 100157
            }
          ]
        }
      },
      false
    );

    expect(output.indexOf('101')).toBeLessThan(output.indexOf('205'));
  });

  it('renders list rows with fallback placeholder values', () => {
    const output = renderReservedIpResult(
      {
        action: 'list',
        items: [
          {
            ...sampleReservedIpItem(),
            appliance_type: null,
            project_name: null,
            reserved_type: null,
            status: null,
            vm_id: null,
            vm_name: null
          }
        ]
      },
      false
    );

    expect(output).toContain('--');
    expect(output).toContain('164.52.198.54');
  });

  it('renders deleted reserved-ip output for humans', () => {
    const output = renderReservedIpResult(
      {
        action: 'delete',
        cancelled: false,
        ip_address: '164.52.198.54',
        message: 'IP Released 164.52.198.54'
      },
      false
    );

    expect(output).toBe(
      'Deleted reserved IP 164.52.198.54.\nMessage: IP Released 164.52.198.54\n'
    );
  });

  it('sorts reserved-ip list json output by ip address and reserve id', () => {
    const output = renderReservedIpResult(
      {
        action: 'list',
        items: [
          {
            ...sampleReservedIpItem(),
            ip_address: '216.48.184.202',
            reserve_id: 12663
          },
          {
            ...sampleReservedIpItem(),
            reserve_id: 12661
          }
        ]
      },
      true
    );

    expect(output.indexOf('"ip_address": "164.52.198.54"')).toBeLessThan(
      output.indexOf('"ip_address": "216.48.184.202"')
    );
  });

  it('renders attachment tables with placeholder values for null fields', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: [
            {
              id: null,
              ip_address_private: null,
              ip_address_public: null,
              name: null,
              security_group_status: null,
              status_name: null,
              vm_id: null
            }
          ]
        }
      },
      false
    );

    expect(output).toContain('Floating Attached Nodes (1)');
    expect(output).toContain('--');
  });

  it('renders create and delete output with fallback placeholders when metadata is missing', () => {
    const createOutput = renderReservedIpResult(
      {
        action: 'create',
        reserved_ip: {
          ...sampleReservedIpItem(),
          appliance_type: null,
          project_name: null,
          reserve_id: null,
          reserved_type: null,
          status: null
        },
        source: 'default-network'
      },
      false
    );
    const deleteOutput = renderReservedIpResult(
      {
        action: 'delete',
        cancelled: false,
        ip_address: '164.52.198.54'
      },
      false
    );

    expect(createOutput).toContain('Status: --');
    expect(createOutput).toContain('Type: --');
    expect(createOutput).toContain('Project: --');
    expect(createOutput).toContain('Reserve ID: --');
    expect(deleteOutput).toBe(
      'Deleted reserved IP 164.52.198.54.\nMessage: \n'
    );
  });

  it('sorts attachment rows with null ids after concrete ids and sorts tie-breaks by reserve id', () => {
    const getOutput = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: [
            {
              id: null,
              ip_address_private: '10.0.0.8',
              ip_address_public: '164.52.198.60',
              name: 'node-null',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: null
            },
            {
              id: 101,
              ip_address_private: '10.0.0.5',
              ip_address_public: '164.52.198.55',
              name: 'node-a',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: 100157
            }
          ]
        }
      },
      false
    );
    const listOutput = renderReservedIpResult(
      {
        action: 'list',
        items: [
          {
            ...sampleReservedIpItem(),
            reserve_id: null
          },
          {
            ...sampleReservedIpItem(),
            reserve_id: 12661
          }
        ]
      },
      true
    );

    expect(getOutput.indexOf('101')).toBeLessThan(
      getOutput.indexOf('node-null')
    );
    expect(listOutput.indexOf('"reserve_id": 12661')).toBeLessThan(
      listOutput.indexOf('"reserve_id": null')
    );
  });

  it('sorts attachment rows by name when ids and vm ids are both null', () => {
    const output = renderReservedIpResult(
      {
        action: 'get',
        reserved_ip: {
          ...sampleReservedIpItem(),
          floating_ip_attached_nodes: [
            {
              id: null,
              ip_address_private: '10.0.0.9',
              ip_address_public: '164.52.198.62',
              name: 'zeta',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: null
            },
            {
              id: null,
              ip_address_private: '10.0.0.8',
              ip_address_public: '164.52.198.61',
              name: 'alpha',
              security_group_status: 'Updated',
              status_name: 'Running',
              vm_id: null
            }
          ]
        }
      },
      false
    );

    expect(output.indexOf('alpha')).toBeLessThan(output.indexOf('zeta'));
  });
});
