import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
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
        id: 27835,
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
          id: 27835,
          name: 'prod-vpc',
          network_id: 27835,
          project_id: '46429',
          vpc_id: 3956
        }
      },
      false
    );

    expect(output).toContain('Created VPC request: prod-vpc');
    expect(output).toContain('VPC ID: 27835');
    expect(output).toContain('Backend Record ID: 3956');
    expect(output).toContain('Billing: committed');
    expect(output).toContain(formatCliCommand('vpc get 27835'));
  });

  it('renders empty list and delete cancellation output clearly', () => {
    const emptyListOutput = renderVpcResult(
      {
        action: 'list',
        items: [],
        total_count: 0,
        total_page_number: 0
      },
      false
    );
    const cancelledDeleteOutput = renderVpcResult(
      {
        action: 'delete',
        cancelled: true,
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          project_id: '46429'
        }
      },
      false
    );

    expect(emptyListOutput).toBe('No VPCs found.\n');
    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
  });

  it('renders VPC detail output with subnet summaries', () => {
    const output = renderVpcResult(
      {
        action: 'get',
        vpc: {
          attached_vm_count: 2,
          cidr: '10.20.0.0/23',
          cidr_source: 'e2e',
          created_at: '2026-03-13T08:00:00Z',
          gateway_ip: '10.20.0.1',
          id: 27835,
          location: 'Delhi',
          name: 'prod-vpc',
          network_id: 27835,
          project_name: 'default-project',
          state: 'Active',
          subnet_count: 1,
          subnets: [
            {
              cidr: '10.20.0.0/24',
              id: 991,
              name: 'frontend',
              total_ips: 251,
              used_ips: 4
            }
          ]
        }
      },
      false
    );

    expect(output).toContain('VPC ID: 27835');
    expect(output).toContain('Gateway IP: 10.20.0.1');
    expect(output).toContain('Subnet Details: frontend (991, 10.20.0.0/24)');
  });

  it('renders empty hourly and committed plan sections', () => {
    const output = renderVpcResult(
      {
        action: 'plans',
        committed: {
          default_post_commit_behavior: 'auto-renew',
          items: [],
          supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
        },
        hourly: {
          items: []
        }
      },
      false
    );

    expect(output).toContain('Hourly');
    expect(output).toContain('No hourly plans found.');
    expect(output).toContain('Committed');
    expect(output).toContain('No committed plans found.');
  });

  it('renders deterministic json for hourly custom CIDR VPC creation', () => {
    const output = renderVpcResult(
      {
        action: 'create',
        billing: {
          committed_plan_id: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        cidr: {
          source: 'custom',
          value: '10.10.0.0/23'
        },
        credit_sufficient: true,
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          network_id: 27835,
          project_id: '46429',
          vpc_id: 3956
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'create',
        billing: {
          committed_plan_id: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        cidr: {
          source: 'custom',
          value: '10.10.0.0/23'
        },
        credit_sufficient: true,
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          network_id: 27835,
          project_id: '46429',
          vpc_id: 3956
        }
      })}\n`
    );
  });

  it('renders hourly VPC create output with an E2E-provided CIDR summary', () => {
    const output = renderVpcResult(
      {
        action: 'create',
        billing: {
          committed_plan_id: null,
          post_commit_behavior: null,
          type: 'hourly'
        },
        cidr: {
          source: 'e2e',
          value: null
        },
        credit_sufficient: true,
        vpc: {
          id: 27836,
          name: 'hourly-vpc',
          network_id: 27836,
          project_id: '46429',
          vpc_id: 3957
        }
      },
      false
    );

    expect(output).toContain('Created VPC request: hourly-vpc');
    expect(output).toContain('Billing: hourly');
    expect(output).toContain('CIDR: E2E-provided');
  });

  it('renders deterministic json for a deleted VPC', () => {
    const output = renderVpcResult(
      {
        action: 'delete',
        cancelled: false,
        message: 'VPC deleted successfully.',
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          project_id: '46429'
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: 'VPC deleted successfully.',
        vpc: {
          id: 27835,
          name: 'prod-vpc',
          project_id: '46429'
        }
      })}\n`
    );
  });

  it('sorts VPC list json output deterministically', () => {
    const output = renderVpcResult(
      {
        action: 'list',
        items: [
          {
            attached_vm_count: 0,
            cidr: '10.30.0.0/24',
            cidr_source: 'custom',
            created_at: '2026-03-13T09:00:00Z',
            gateway_ip: '10.30.0.1',
            id: 27836,
            location: 'Chennai',
            name: 'zeta-vpc',
            network_id: 27836,
            project_name: 'default-project',
            state: 'Active',
            subnet_count: 0,
            subnets: []
          },
          {
            attached_vm_count: 2,
            cidr: '10.20.0.0/23',
            cidr_source: 'e2e',
            created_at: '2026-03-13T08:00:00Z',
            gateway_ip: '10.20.0.1',
            id: 27835,
            location: 'Delhi',
            name: 'alpha-vpc',
            network_id: 27835,
            project_name: 'default-project',
            state: 'Active',
            subnet_count: 0,
            subnets: []
          }
        ],
        total_count: 2,
        total_page_number: 1
      },
      true
    );

    expect(output).toContain('"name": "alpha-vpc"');
    expect(output.indexOf('"name": "alpha-vpc"')).toBeLessThan(
      output.indexOf('"name": "zeta-vpc"')
    );
  });

  it('renders VPC detail output without subnet details when no subnets exist', () => {
    const output = renderVpcResult(
      {
        action: 'get',
        vpc: {
          attached_vm_count: 0,
          cidr: '10.20.0.0/23',
          cidr_source: 'custom',
          created_at: '2026-03-13T08:00:00Z',
          gateway_ip: null,
          id: 27835,
          location: null,
          name: 'prod-vpc',
          network_id: 27835,
          project_name: null,
          state: 'Active',
          subnet_count: 0,
          subnets: []
        }
      },
      false
    );

    expect(output).toContain('Source: Custom');
    expect(output).toContain('Subnets: 0');
    expect(output).not.toContain('Subnet Details:');
  });

  it('renders plans output with committed options but no hourly plans', () => {
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
      false
    );

    expect(output).toContain('Hourly');
    expect(output).toContain('No hourly plans found.');
    expect(output).toContain('Committed');
    expect(output).toContain('90 Days');
  });
});
