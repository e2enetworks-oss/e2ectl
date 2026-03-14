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
      'e2ectl volume create --name <name> --size <size-gb> --billing-type hourly'
    );
    expect(output).toContain(
      'e2ectl volume create --name <name> --size <size-gb> --billing-type committed --committed-plan-id <id>'
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
    expect(output).toContain('e2ectl volume plans --size <size-gb>');
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
    expect(output).toContain('e2ectl volume list');
  });
});
