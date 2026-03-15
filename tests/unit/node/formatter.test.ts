import { formatCliCommand } from '../../../src/app/metadata.js';
import {
  formatNodeCatalogCommittedOptionsTable,
  formatNodeCatalogOsTable,
  formatNodeCatalogPlansTable,
  renderNodeResult,
  formatNodeCreateResult,
  formatNodeDetails,
  formatNodesTable,
  summarizeNodeCatalogOs
} from '../../../src/node/formatter.js';

describe('node formatter', () => {
  it('renders stable node list and detail output', () => {
    const table = formatNodesTable([
      {
        id: 101,
        name: 'node-a',
        status: 'Running',
        plan: 'C3.8GB',
        public_ip_address: '1.1.1.1',
        private_ip_address: '10.0.0.1'
      }
    ]);
    const details = formatNodeDetails({
      id: 101,
      name: 'node-a',
      status: 'Running',
      plan: 'C3.8GB',
      public_ip_address: '1.1.1.1',
      private_ip_address: '10.0.0.1',
      location: 'Delhi'
    });

    expect(table).toContain('node-a');
    expect(table).toContain('C3.8GB');
    expect(details).toContain('ID: 101');
    expect(details).toContain('Location: Delhi');
  });

  it('renders create summaries with counts and created nodes', () => {
    const output = formatNodeCreateResult({
      node_create_response: [
        {
          id: 205,
          name: 'node-b',
          plan: 'C3.8GB',
          status: 'Creating'
        }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    });

    expect(output).toContain('Requested: 1');
    expect(output).toContain('Created: 1');
    expect(output).toContain('node-b');
  });

  it('renders billing metadata for node create results', () => {
    const output = renderNodeResult(
      {
        action: 'create',
        billing: {
          billing_type: 'committed',
          committed_plan_id: 2711,
          post_commit_behavior: 'auto_renew'
        },
        result: {
          node_create_response: [],
          total_number_of_node_created: 1,
          total_number_of_node_requested: 1
        }
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'create',
        billing: {
          billing_type: 'hourly'
        },
        result: {
          node_create_response: [],
          total_number_of_node_created: 1,
          total_number_of_node_requested: 1
        }
      },
      true
    );

    expect(output).toContain('Billing Type: committed');
    expect(output).toContain('Committed Plan ID: 2711');
    expect(output).toContain('Post-Commit Behavior: auto_renew');
    expect(jsonOutput).toBe(
      JSON.stringify(
        {
          action: 'create',
          billing: {
            billing_type: 'hourly'
          },
          created: 1,
          nodes: [],
          requested: 1
        },
        null,
        2
      ) + '\n'
    );
  });

  it('flattens OS catalog rows into command-ready entries', () => {
    const entries = summarizeNodeCatalogOs({
      category_list: [
        {
          OS: 'Ubuntu',
          category: ['Linux Virtual Node', 'Linux Smart Dedicated Compute'],
          version: [
            {
              number_of_domains: null,
              os: 'Ubuntu',
              software_version: '',
              sub_category: 'Ubuntu',
              version: '24.04'
            }
          ]
        }
      ]
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      category: 'Ubuntu',
      display_category: 'Linux Smart Dedicated Compute',
      os: 'Ubuntu',
      os_version: '24.04'
    });
    expect(entries[1]).toMatchObject({
      display_category: 'Linux Virtual Node'
    });

    const table = formatNodeCatalogOsTable(entries);
    expect(table).toContain('Linux Virtual Node');
    expect(table).toContain('24.04');
    expect(table).not.toContain('Software Version');
  });

  it('shows the software version column when the API returns populated values', () => {
    const table = formatNodeCatalogOsTable([
      {
        category: 'TensorFlow',
        display_category: 'GPU',
        number_of_domains: null,
        os: 'Ubuntu',
        os_version: '20.04',
        software_version: '2.15'
      }
    ]);

    expect(table).toContain('Software Version');
    expect(table).toContain('2.15');
  });

  it('renders config-first plan and committed-option tables', () => {
    const table = formatNodeCatalogPlansTable([
      {
        available_inventory: true,
        committed_options: [
          {
            days: 90,
            id: 2711,
            name: '90 Days Committed , Rs. 6026.0',
            total_price: 6026
          }
        ],
        config: {
          disk_gb: 100,
          family: 'CPU Intensive 3rd Generation',
          ram: '8.00',
          series: 'C3',
          vcpu: 4
        },
        currency: 'INR',
        hourly: {
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        row: 1,
        sku: 'C3.8GB'
      }
    ]);
    const committedTable = formatNodeCatalogCommittedOptionsTable([
      {
        available_inventory: true,
        committed_options: [
          {
            days: 90,
            id: 2711,
            name: '90 Days Committed , Rs. 6026.0',
            total_price: 6026
          }
        ],
        config: {
          disk_gb: 100,
          family: 'CPU Intensive 3rd Generation',
          ram: '8.00',
          series: 'C3',
          vcpu: 4
        },
        currency: 'INR',
        hourly: {
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        row: 1,
        sku: 'C3.8GB'
      }
    ]);

    expect(table).toContain('Ubuntu-24.04-Distro');
    expect(table).toContain('3.1 INR/hr');
    expect(table).toContain('C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi');
    expect(committedTable).toContain('Config #');
    expect(committedTable).toContain('Committed Plan ID');
    expect(committedTable).toContain('4 vCPU / 8 GB / 100 GB');
    expect(committedTable).toContain('2711');
  });

  it('renders discovery-first plan guidance with hourly and committed examples', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [
              {
                days: 90,
                id: 2711,
                name: '90 Days Committed , Rs. 6026.0',
                total_price: 6026
              }
            ],
            config: {
              disk_gb: 100,
              family: 'CPU Intensive 3rd Generation',
              ram: '8.00',
              series: 'C3',
              vcpu: 4
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 3.1,
              price_per_month: 2263
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
            row: 1,
            sku: 'C3.8GB'
          }
        ],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: ['CPU Intensive 3rd Generation'],
          empty_reason: null
        }
      },
      false
    );

    expect(output).toContain('Filters: OS=Ubuntu 24.04, Billing=all');
    expect(output).toContain(
      'Available Families: CPU Intensive 3rd Generation'
    );
    expect(output).not.toContain('Family=');
    expect(output).toContain('Candidate Configs');
    expect(output).toContain('Committed Options by Config');
    expect(output).toContain('Create hourly from config #1:');
    expect(output).toContain('Create committed from config #1:');
    expect(output).toContain(
      formatCliCommand(
        'node create --name <name> --plan C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi --image Ubuntu-24.04-Distro'
      )
    );
    expect(output).toContain(
      '--billing-type committed --committed-plan-id 2711'
    );
  });

  it('uses the same committed-capable sample row for hourly and committed examples', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [],
            config: {
              disk_gb: 50,
              family: 'CPU Intensive 3rd Generation',
              ram: '4.00',
              series: 'C3',
              vcpu: 2
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 1.8,
              price_per_month: 1321
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
            row: 1,
            sku: 'C3.4GB'
          },
          {
            available_inventory: true,
            committed_options: [
              {
                days: 90,
                id: 2711,
                name: '90 Days Committed , Rs. 6026.0',
                total_price: 6026
              }
            ],
            config: {
              disk_gb: 100,
              family: 'CPU Intensive 3rd Generation',
              ram: '8.00',
              series: 'C3',
              vcpu: 4
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 3.1,
              price_per_month: 2263
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
            row: 2,
            sku: 'C3.8GB'
          }
        ],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      false
    );

    expect(output).toContain('Create hourly from config #2:');
    expect(output).toContain('Create committed from config #2:');
    expect(output).not.toContain('Create hourly from config #1:');
  });

  it('handles empty committed options cleanly when requested', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [],
            config: {
              disk_gb: 100,
              family: 'CPU Intensive 3rd Generation',
              ram: '8.00',
              series: 'C3',
              vcpu: 4
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 3.1,
              price_per_month: 2263
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
            row: 1,
            sku: 'C3.8GB'
          }
        ],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      false
    );

    expect(output).toContain('Committed Options by Config');
    expect(output).toContain(
      'No committed options found for the selected configs.'
    );
    expect(output).toContain('Create hourly from config #1:');
    expect(output).toContain(
      'Committed create example unavailable because the selected configs returned no committed options.'
    );
  });

  it('renders E1 and E1WC zero disk as N/A in human tables and config summaries', () => {
    const items = [
      {
        available_inventory: true,
        committed_options: [
          {
            days: 90,
            id: 2711,
            name: '90 Days Committed , Rs. 6026.0',
            total_price: 6026
          }
        ],
        config: {
          disk_gb: 0,
          family: 'General Purpose',
          ram: '6.00',
          series: 'E1',
          vcpu: 2
        },
        currency: 'INR',
        hourly: {
          minimum_billing_amount: 0,
          price_per_hour: 2.25,
          price_per_month: 1642.5
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
        row: 1,
        sku: 'E1.6GB'
      },
      {
        available_inventory: true,
        committed_options: [],
        config: {
          disk_gb: 0,
          family: 'General Purpose',
          ram: '8.00',
          series: 'E1WC',
          vcpu: 4
        },
        currency: 'INR',
        hourly: {
          minimum_billing_amount: 0,
          price_per_hour: 3.5,
          price_per_month: 2555
        },
        image: 'Windows-2022-Distro',
        plan: 'E1WC-4vCPU-8RAM-0DISK-E1WC.8GB-Windows-2022-Delhi',
        row: 2,
        sku: 'E1WC.8GB'
      }
    ];

    const planTable = formatNodeCatalogPlansTable([...items]);
    const committedTable = formatNodeCatalogCommittedOptionsTable([items[0]!]);

    expect(planTable).toContain('N/A');
    expect(planTable).not.toContain('0 GB');
    expect(committedTable).toContain('2 vCPU / 6 GB / N/A');
  });

  it('renders a family-specific no-match message when the family filter excludes all configs', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          family: 'General Purpose',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: ['Compute Intensive', 'General Purpose'],
          empty_reason: 'no_family_match'
        }
      },
      false
    );

    expect(output).toContain(
      'Filters: OS=Ubuntu 24.04, Billing=all, Family=General Purpose'
    );
    expect(output).toContain(
      'Available Families: Compute Intensive, General Purpose'
    );
    expect(output).toContain(
      'No configs were found for family General Purpose.'
    );
  });

  it('renders the committed-family empty state when the family exists but has no committed options', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'committed',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          family: 'General Purpose',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: ['General Purpose'],
          empty_reason: 'no_committed_for_family'
        }
      },
      false
    );

    expect(output).toContain(
      'Filters: OS=Ubuntu 24.04, Billing=committed, Family=General Purpose'
    );
    expect(output).toContain('Available Families: General Purpose');
    expect(output).toContain(
      'No committed plan options found for family General Purpose.'
    );
  });

  it('renders clean human summaries for node power and attachment actions', () => {
    const powerOutput = renderNodeResult(
      {
        action: 'power-on',
        node_id: 101,
        result: {
          action_id: 701,
          created_at: '2026-03-14T08:10:00Z',
          image_id: null,
          status: 'In Progress'
        }
      },
      false
    );
    const sshKeyOutput = renderNodeResult(
      {
        action: 'ssh-key-attach',
        node_id: 101,
        result: {
          action_id: 801,
          created_at: '2026-03-14T08:00:00Z',
          image_id: null,
          status: 'Done'
        },
        ssh_keys: [
          {
            id: 12,
            label: 'admin'
          },
          {
            id: 13,
            label: 'deploy'
          }
        ]
      },
      false
    );

    expect(powerOutput).toContain('Requested power on for node 101.');
    expect(powerOutput).toContain('Action ID: 701');
    expect(sshKeyOutput).toContain('SSH Keys: admin (12), deploy (13)');
    expect(sshKeyOutput).toContain('Status: Done');
  });

  it('renders deterministic json for the new node action results', () => {
    const output = renderNodeResult(
      {
        action: 'vpc-attach',
        node_id: 101,
        result: {
          message: 'VPC attached successfully.',
          project_id: '46429'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: '10.0.0.25',
          subnet_id: 991
        }
      },
      true
    );

    expect(output).toBe(
      JSON.stringify(
        {
          action: 'vpc-attach',
          node_id: 101,
          result: {
            message: 'VPC attached successfully.',
            project_id: '46429'
          },
          vpc: {
            id: 23082,
            name: 'prod-vpc',
            private_ip: '10.0.0.25',
            subnet_id: 991
          }
        },
        null,
        2
      ) + '\n'
    );
  });

  it('renders grouped deterministic json for catalog plans', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [
              {
                days: 90,
                id: 2711,
                name: '90 Days Committed , Rs. 6026.0',
                total_price: 6026
              }
            ],
            config: {
              disk_gb: 100,
              family: 'CPU Intensive 3rd Generation',
              ram: '8.00',
              series: 'C3',
              vcpu: 4
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 3.1,
              price_per_month: 2263
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
            row: 1,
            sku: 'C3.8GB'
          }
        ],
        query: {
          billing_type: 'all',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      true
    );

    expect(output).toBe(
      JSON.stringify(
        {
          action: 'catalog-plans',
          items: [
            {
              available_inventory: true,
              committed_options: [
                {
                  days: 90,
                  id: 2711,
                  name: '90 Days Committed , Rs. 6026.0',
                  total_price: 6026
                }
              ],
              config: {
                disk_gb: 100,
                family: 'CPU Intensive 3rd Generation',
                ram: '8.00',
                series: 'C3',
                vcpu: 4
              },
              currency: 'INR',
              hourly: {
                minimum_billing_amount: 0,
                price_per_hour: 3.1,
                price_per_month: 2263
              },
              image: 'Ubuntu-24.04-Distro',
              plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
              row: 1,
              sku: 'C3.8GB'
            }
          ],
          query: {
            billing_type: 'all',
            category: 'Ubuntu',
            display_category: 'Linux Virtual Node',
            os: 'Ubuntu',
            osversion: '24.04'
          }
        },
        null,
        2
      ) + '\n'
    );
  });
});
