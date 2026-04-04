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
      'Attached reserved addon IP 164.52.198.54 to node 101.'
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
});
