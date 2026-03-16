import { formatCliCommand } from '../../../src/app/metadata.js';
import {
  formatVpcCommittedPlansTable,
  formatVpcHourlyPlansTable,
  formatVpcListTable,
  renderVpcResult
} from '../../../src/vpc/formatter.js';

describe('vpc formatter', () => {
  it('renders stable VPC list tables', () => {
    const table = formatVpcListTable([
      {
        attached_vm_count: 2,
        cidr: '10.20.0.0/23',
        cidr_source: 'e2e',
        created_at: '2026-03-13T08:00:00Z',
        gateway_ip: '10.20.0.1',
        location: 'Delhi',
        name: 'prod-vpc',
        network_id: 27835,
        project_name: 'default-project',
        state: 'Active',
        subnet_count: 0,
        subnets: []
      }
    ]);

    expect(table).toContain('prod-vpc');
    expect(table).toContain('27835');
    expect(table).toContain('E2E');
  });

  it('renders separate hourly and committed plan tables', () => {
    const hourlyTable = formatVpcHourlyPlansTable([
      {
        currency: 'INR',
        location: 'Delhi',
        name: 'VPC',
        price_per_hour: 4.79,
        price_per_month: 3500
      }
    ]);
    const committedTable = formatVpcCommittedPlansTable([
      {
        currency: 'INR',
        id: 91,
        name: '90 Days',
        term_days: 90,
        total_price: 7800
      }
    ]);

    expect(hourlyTable).toContain('4.79 INR');
    expect(hourlyTable).toContain('3500 INR');
    expect(committedTable).toContain('90 Days');
    expect(committedTable).not.toContain('Effective Price/Hour');
    expect(committedTable).not.toContain('3.56 INR');
  });

  it('renders VPC plan guidance for both committed CIDR modes', () => {
    const output = renderVpcResult(
      {
        action: 'plans',
        committed: {
          default_post_commit_behavior: 'auto-renew',
          items: [
            {
              currency: 'INR',
              id: 91,
              name: '90 Days',
              term_days: 90,
              total_price: 7800
            }
          ],
          supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
        },
        hourly: {
          items: [
            {
              currency: 'INR',
              location: 'Delhi',
              name: 'VPC',
              price_per_hour: 4.79,
              price_per_month: 3500
            }
          ]
        }
      },
      false
    );

    expect(output).toContain(
      formatCliCommand(
        'vpc create --name <name> --billing-type committed --committed-plan-id <id> --cidr-source e2e'
      )
    );
    expect(output).toContain(
      formatCliCommand(
        'vpc create --name <name> --billing-type committed --committed-plan-id <id> --cidr-source custom --cidr <cidr>'
      )
    );
  });

  it('omits non-authoritative committed hourly pricing from json output', () => {
    const output = renderVpcResult(
      {
        action: 'plans',
        committed: {
          default_post_commit_behavior: 'auto-renew',
          items: [
            {
              currency: 'INR',
              id: 91,
              name: '90 Days',
              term_days: 90,
              total_price: 7800
            }
          ],
          supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
        },
        hourly: {
          items: []
        }
      },
      true
    );

    const payload = JSON.parse(output) as {
      committed: { items: Array<Record<string, unknown>> };
    };

    expect(payload.committed.items[0]).not.toHaveProperty(
      'effective_price_per_hour'
    );
  });

  it('renders VPC create human output with the next-step hint', () => {
    const output = renderVpcResult(
      {
        action: 'create',
        billing: {
          committed_plan_id: 91,
          post_commit_behavior: 'auto-renew',
          type: 'committed'
        },
        cidr: {
          source: 'custom',
          value: '10.10.0.0/23'
        },
        credit_sufficient: true,
        vpc: {
          name: 'prod-vpc',
          network_id: 27835,
          project_id: '46429',
          vpc_id: 3956
        }
      },
      false
    );

    expect(output).toContain('Created VPC request: prod-vpc');
    expect(output).toContain('Billing: committed');
    expect(output).toContain(formatCliCommand('vpc list'));
  });
});
