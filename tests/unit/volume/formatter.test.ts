import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import {
  formatVolumeCommittedPlansTable,
  formatVolumeListTable,
  formatVolumePlansTable,
  renderVolumeResult
} from '../../../src/volume/formatter.js';

describe('volume formatter', () => {
  it('renders stable volume list tables', () => {
    const table = formatVolumeListTable([
      {
        attached: true,
        attachment: {
          node_id: 301,
          vm_id: 100157,
          vm_name: 'node-b'
        },
        id: 25550,
        name: 'data-01',
        size_gb: 250,
        size_label: '250 GB',
        status: 'Attached'
      }
    ]);

    expect(table).toContain('data-01');
    expect(table).toContain('250 GB');
    expect(table).toContain('node-b');
  });

  it('renders grouped plan and committed option tables', () => {
    const plansTable = formatVolumePlansTable([
      {
        available: true,
        committed_options: [],
        currency: 'INR',
        hourly_price: 1.71,
        iops: 5000,
        size_gb: 250
      }
    ]);
    const committedTable = formatVolumeCommittedPlansTable([
      {
        id: 31,
        name: '30 Days Committed',
        savings_percent: 18.78,
        term_days: 30,
        total_price: 1000
      }
    ]);

    expect(plansTable).toContain('250');
    expect(plansTable).toContain('1.71 INR');
    expect(committedTable).toContain('30 Days Committed');
    expect(committedTable).toContain('18.78');
  });

  it('renders human plan guidance for discovery-first volume creation', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: false,
          size_gb: 250
        },
        items: [
          {
            available: true,
            committed_options: [
              {
                id: 31,
                name: '30 Days Committed',
                savings_percent: 18.78,
                term_days: 30,
                total_price: 1000
              }
            ],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          }
        ],
        total_count: 1
      },
      false
    );

    expect(output).toContain('Showing 1 plan row for size 250 GB.');
    expect(output).toContain('Base Plans (1)');
    expect(output).toContain('Committed Options For 250 GB');
    expect(output).toContain(
      formatCliCommand(
        'volume create --name <name> --size <size-gb> --billing-type hourly'
      )
    );
    expect(output).toContain(
      formatCliCommand(
        'volume create --name <name> --size <size-gb> --billing-type committed --committed-plan-id <id>'
      )
    );
  });

  it('renders a compact shared committed-term reference for multi-size discovery', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: false,
          size_gb: null
        },
        items: [
          {
            available: true,
            committed_options: [
              {
                id: 31,
                name: '30 Days Committed',
                savings_percent: 18.78,
                term_days: 30,
                total_price: 1000
              }
            ],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          },
          {
            available: true,
            committed_options: [
              {
                id: 31,
                name: '30 Days Committed',
                savings_percent: 17.5,
                term_days: 30,
                total_price: 4000
              }
            ],
            currency: 'INR',
            hourly_price: 6.85,
            iops: 15000,
            size_gb: 1000
          }
        ],
        total_count: 2
      },
      false
    );

    expect(output).toContain('Showing 2 plan rows.');
    expect(output).toContain('Committed Terms');
    expect(output).toContain('30 Days Committed');
    expect(output).toContain(formatCliCommand('volume plans --size <size-gb>'));
    expect(output).not.toContain('Committed Options For 250 GB');
  });

  it('renders volume create human output with derived iops and next step', () => {
    const output = renderVolumeResult(
      {
        action: 'create',
        billing: {
          committed_plan: {
            id: 31,
            name: '30 Days Committed',
            savings_percent: 18.78,
            term_days: 30,
            total_price: 1000
          },
          post_commit_behavior: 'auto-renew',
          type: 'committed'
        },
        requested: {
          name: 'data-01',
          size_gb: 250
        },
        resolved_plan: {
          available: true,
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        },
        volume: {
          id: 25550,
          name: 'data-01'
        }
      },
      false
    );

    expect(output).toContain('Created volume: data-01');
    expect(output).toContain('Derived IOPS: 5000');
    expect(output).toContain('Committed Plan: 31');
    expect(output).toContain(formatCliCommand('volume list'));
  });

  it('renders empty lists and delete flows predictably', () => {
    const emptyListOutput = renderVolumeResult(
      {
        action: 'list',
        items: [],
        total_count: 0,
        total_page_number: 0
      },
      false
    );
    const cancelledDeleteOutput = renderVolumeResult(
      {
        action: 'delete',
        cancelled: true,
        volume_id: 25550
      },
      false
    );
    const deletedJsonOutput = renderVolumeResult(
      {
        action: 'delete',
        cancelled: false,
        message: 'Block Storage Deleted',
        volume_id: 25550
      },
      true
    );

    expect(emptyListOutput).toBe('No volumes found.\n');
    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
    expect(deletedJsonOutput).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: 'Block Storage Deleted',
        volume_id: 25550
      })}\n`
    );
  });

  it('renders volume details with attachment context', () => {
    const output = renderVolumeResult(
      {
        action: 'get',
        volume: {
          attached: true,
          attachment: {
            node_id: 301,
            vm_id: 100157,
            vm_name: 'node-b'
          },
          exporting_to_eos: false,
          id: 25550,
          name: 'data-01',
          size_gb: 250,
          size_label: '250 GB',
          snapshot_exists: true,
          status: 'Attached'
        }
      },
      false
    );

    expect(output).toContain('ID: 25550');
    expect(output).toContain('Attached: yes');
    expect(output).toContain('Snapshot Exists: yes');
    expect(output).toContain('Attached To: node-b (node 301)');
  });

  it('renders empty available-only plan output clearly', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: true,
          size_gb: null
        },
        items: [],
        total_count: 0
      },
      false
    );

    expect(output).toContain(
      'Showing 0 plan rows for available inventory only.'
    );
    expect(output).toContain('No available volume plans found.');
  });

  it('renders deterministic json for hourly volume creation', () => {
    const output = renderVolumeResult(
      {
        action: 'create',
        billing: {
          committed_plan: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        requested: {
          name: 'data-01',
          size_gb: 250
        },
        resolved_plan: {
          available: true,
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        },
        volume: {
          id: 25550,
          name: 'data-01'
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'create',
        billing: {
          committed_plan: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        requested: {
          name: 'data-01',
          size_gb: 250
        },
        resolved_plan: {
          available: true,
          currency: 'INR',
          hourly_price: 1.71,
          iops: 5000,
          size_gb: 250
        },
        volume: {
          id: 25550,
          name: 'data-01'
        }
      })}\n`
    );
  });

  it('renders hourly volume create output without committed-only billing lines', () => {
    const output = renderVolumeResult(
      {
        action: 'create',
        billing: {
          committed_plan: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        requested: {
          name: 'data-02',
          size_gb: 500
        },
        resolved_plan: {
          available: true,
          currency: null,
          hourly_price: null,
          iops: 10000,
          size_gb: 500
        },
        volume: {
          id: 25551,
          name: 'data-02'
        }
      },
      false
    );

    expect(output).toContain('Created volume: data-02');
    expect(output).toContain('Billing: hourly');
    expect(output).not.toContain('Committed Plan:');
    expect(output).not.toContain('Post-Commit:');
    expect(output).not.toContain('Hourly Price Reference:');
  });

  it('renders volume details without attachment context when the volume is detached', () => {
    const output = renderVolumeResult(
      {
        action: 'get',
        volume: {
          attached: false,
          attachment: null,
          exporting_to_eos: false,
          id: 25551,
          name: 'data-02',
          size_gb: 500,
          size_label: '500 GB',
          snapshot_exists: false,
          status: 'Reserved'
        }
      },
      false
    );

    expect(output).toContain('Attached: no');
    expect(output).toContain('Snapshot Exists: no');
    expect(output).toContain('Exporting To EOS: no');
    expect(output).not.toContain('Attached To:');
  });

  it('renders the single-size no-committed-options branch clearly', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: false,
          size_gb: 250
        },
        items: [
          {
            available: true,
            committed_options: [],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          }
        ],
        total_count: 1
      },
      false
    );

    expect(output).toContain('Committed Options For 250 GB');
    expect(output).toContain('No committed options found.');
  });

  it('renders a committed-pricing guidance branch when committed options vary by size', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: false,
          size_gb: null
        },
        items: [
          {
            available: true,
            committed_options: [
              {
                id: 31,
                name: '30 Days Committed',
                savings_percent: 18.78,
                term_days: 30,
                total_price: 1000
              }
            ],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          },
          {
            available: true,
            committed_options: [
              {
                id: 92,
                name: '90 Days Committed',
                savings_percent: 22.5,
                term_days: 90,
                total_price: 7800
              }
            ],
            currency: 'INR',
            hourly_price: 6.85,
            iops: 15000,
            size_gb: 1000
          }
        ],
        total_count: 2
      },
      false
    );

    expect(output).toContain('Committed Pricing');
    expect(output).toContain('Committed options vary by size.');
    expect(output).toContain(formatCliCommand('volume plans --size <size-gb>'));
    expect(output).not.toContain('Committed Terms');
  });

  it('omits committed guidance entirely when no committed plans are available for any size', () => {
    const output = renderVolumeResult(
      {
        action: 'plans',
        filters: {
          available_only: false,
          size_gb: null
        },
        items: [
          {
            available: true,
            committed_options: [],
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          },
          {
            available: true,
            committed_options: [],
            currency: 'INR',
            hourly_price: 6.85,
            iops: 15000,
            size_gb: 1000
          }
        ],
        total_count: 2
      },
      false
    );

    expect(output).toContain('Base Plans (2)');
    expect(output).toContain('Create with explicit size and billing:');
    expect(output).not.toContain('Committed Terms');
    expect(output).not.toContain('Committed Pricing');
  });
});
