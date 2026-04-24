import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
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

  it('renders create summaries without a table when no nodes were created', () => {
    const output = formatNodeCreateResult({
      node_create_response: [],
      total_number_of_node_created: 0,
      total_number_of_node_requested: 2
    });

    expect(output).toBe('Requested: 2\nCreated: 0');
  });

  it('sorts node list json output by id for deterministic automation output', () => {
    const output = renderNodeResult(
      {
        action: 'list',
        nodes: [
          {
            id: 205,
            is_locked: false,
            name: 'node-b',
            plan: 'C3.16GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Running'
          },
          {
            id: 101,
            is_locked: false,
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running'
          }
        ],
        total_count: 2,
        total_page_number: 1
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'list',
        nodes: [
          {
            id: 101,
            is_locked: false,
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running'
          },
          {
            id: 205,
            is_locked: false,
            name: 'node-b',
            plan: 'C3.16GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Running'
          }
        ],
        total_count: 2,
        total_page_number: 1
      })}\n`
    );
  });

  it('sorts human node list output by id for deterministic operator output', () => {
    const output = renderNodeResult(
      {
        action: 'list',
        nodes: [
          {
            id: 205,
            is_locked: false,
            name: 'node-b',
            plan: 'C3.16GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Running'
          },
          {
            id: 101,
            is_locked: false,
            name: 'node-a',
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.1',
            public_ip_address: '1.1.1.1',
            status: 'Running'
          }
        ],
        total_count: 2,
        total_page_number: 1
      },
      false
    );

    expect(output.indexOf('node-a')).toBeLessThan(output.indexOf('node-b'));
    expect(output).toContain('101');
    expect(output).toContain('205');
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

  it('renders delete output with explicit reserve-public-ip state when requested', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: false,
        message: 'Success',
        node_id: 101,
        reserve_public_ip_requested: true
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: true,
        node_id: 101,
        reserve_public_ip_requested: false
      },
      true
    );

    expect(humanOutput).toBe(
      'Requested deletion for node 101.\n' +
        'The node may remain visible as Terminating for a short time.\n' +
        'Reserved Public IP: requested.\n'
    );
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: true,
        node_id: 101,
        reserve_public_ip_requested: false
      })}\n`
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

  it('renders populated catalog-os guidance for humans', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-os',
        catalog: {
          category_list: [
            {
              OS: 'Ubuntu',
              category: ['GPU Optimized'],
              version: [
                {
                  number_of_domains: null,
                  os: 'Ubuntu',
                  sub_category: 'Ubuntu',
                  version: '24.04'
                }
              ]
            }
          ]
        }
      },
      false
    );

    expect(output).toContain('GPU Optimized');
    expect(output).toContain('Ubuntu');
    expect(output).toContain('Use one row with:');
    expect(output).toContain(
      formatCliCommand(
        'node catalog plans --display-category <value> --category <value> --os <value> --os-version <value>'
      )
    );
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

  it('renders plan tables with null, text, and unavailable values cleanly', () => {
    const planTable = formatNodeCatalogPlansTable([
      {
        available_inventory: false,
        committed_options: [],
        config: {
          disk_gb: null,
          family: 'General Purpose',
          ram: null,
          series: null,
          vcpu: null
        },
        currency: null,
        hourly: {
          minimum_billing_amount: null,
          price_per_hour: null,
          price_per_month: null
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'PLAN-NULLS',
        row: 1,
        sku: 'SKU-NULLS'
      },
      {
        available_inventory: true,
        committed_options: [],
        config: {
          disk_gb: 50,
          family: 'Burst',
          ram: 'Burst',
          series: 'C3',
          vcpu: 2
        },
        currency: null,
        hourly: {
          minimum_billing_amount: null,
          price_per_hour: 3.1,
          price_per_month: null
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'PLAN-TEXT-RAM',
        row: 2,
        sku: 'SKU-TEXT'
      }
    ]);

    const committedTable = formatNodeCatalogCommittedOptionsTable([
      {
        available_inventory: true,
        committed_options: [
          {
            days: null,
            id: 77,
            name: 'Undefined price',
            total_price: undefined as unknown as number | null
          },
          {
            days: 30,
            id: 78,
            name: 'Currencyless price',
            total_price: 1234
          }
        ],
        config: {
          disk_gb: null,
          family: 'General Purpose',
          ram: '8.00',
          series: 'C3',
          vcpu: null
        },
        currency: null,
        hourly: {
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263
        },
        image: 'Ubuntu-24.04-Distro',
        plan: 'PLAN-COMMITTED',
        row: 3,
        sku: 'SKU-COMMITTED'
      }
    ]);

    expect(planTable).toContain('SKU-NULLS');
    expect(planTable).toContain('SKU-TEXT');
    expect(planTable).toContain('no');
    expect(planTable).toContain('Burst GB');
    expect(planTable).not.toContain('null');
    expect(committedTable).toContain('SKU-COMMITTED');
    expect(committedTable).toContain('77');
    expect(committedTable).toContain('78');
    expect(committedTable).toContain('1234');
    expect(committedTable).not.toContain('undefined');
  });

  it('renders missing node detail fields as blank strings', () => {
    const details = formatNodeDetails({
      id: 102,
      name: 'node-b',
      plan: 'C3.4GB',
      status: 'Stopped'
    });

    expect(details).toContain('Public IP: ');
    expect(details).toContain('Private IP: ');
    expect(details).toContain('Location: ');
    expect(details).toContain('Created At: ');
    expect(details).toContain('Disk: ');
    expect(details).toContain('Memory: ');
    expect(details).toContain('vCPUs: ');
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

  it('shows E1 create examples with disk guidance and the default storage example', () => {
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

    expect(output).toContain(
      formatCliCommand(
        'node create --name <name> --plan E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi --image Ubuntu-24.04-Distro --disk 150'
      )
    );
    expect(output).toContain(
      'E1/E1WC configs also require --disk <size-gb>. Allowed sizes: 75-2400 GB; 25 GB steps below 150 GB; 50 GB steps at or above 150 GB.'
    );
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

  it('derives and sorts available families from items when summary is omitted', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [
          {
            available_inventory: true,
            committed_options: [],
            config: {
              disk_gb: 100,
              family: 'Zeta',
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
            plan: 'PLAN-ZETA',
            row: 1,
            sku: 'SKU-ZETA'
          },
          {
            available_inventory: true,
            committed_options: [],
            config: {
              disk_gb: 50,
              family: null,
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
            plan: 'PLAN-NO-FAMILY',
            row: 2,
            sku: 'SKU-NO-FAMILY'
          },
          {
            available_inventory: true,
            committed_options: [],
            config: {
              disk_gb: 75,
              family: 'Alpha',
              ram: '6.00',
              series: 'C3',
              vcpu: 3
            },
            currency: 'INR',
            hourly: {
              minimum_billing_amount: 0,
              price_per_hour: 2.5,
              price_per_month: 1825
            },
            image: 'Ubuntu-24.04-Distro',
            plan: 'PLAN-ALPHA',
            row: 3,
            sku: 'SKU-ALPHA'
          }
        ],
        query: {
          billing_type: 'hourly',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      false
    );

    expect(output).toContain('Available Families: Alpha, Zeta');
    expect(output).not.toContain('No plans found');
  });

  it('renders explicit and fallback empty catalog messages', () => {
    const noCommittedOutput = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'committed',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: [],
          empty_reason: 'no_committed'
        }
      },
      false
    );

    const noPlansOutput = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'hourly',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: [],
          empty_reason: 'no_plans'
        }
      },
      false
    );

    const fallbackFamilyOutput = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'hourly',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          family: 'GPU',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      false
    );

    const fallbackCommittedOutput = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'committed',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          os: 'Ubuntu',
          osversion: '24.04'
        }
      },
      false
    );

    expect(noCommittedOutput).toContain(
      'No committed plan options found for the selected OS row.'
    );
    expect(noPlansOutput).toContain('No plans found for the selected OS row.');
    expect(fallbackFamilyOutput).toContain(
      'No configs were found for family GPU.'
    );
    expect(fallbackCommittedOutput).toContain(
      'No committed plan options found for the selected OS row.'
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

  it('renders warnings and deterministic json for public-ip detach results', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'public-ip-detach',
        message: 'Public IP detached successfully.',
        node_id: 101,
        public_ip: '151.185.42.45'
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'public-ip-detach',
        message: 'Public IP detached successfully.',
        node_id: 101,
        public_ip: '151.185.42.45'
      },
      true
    );

    expect(humanOutput).toContain('Requested public IP detach for node 101.');
    expect(humanOutput).toContain('Public IP: 151.185.42.45');
    expect(humanOutput).toContain('Message: Public IP detached successfully.');
    expect(humanOutput).toContain(
      'Warning: This node may no longer be publicly reachable.'
    );
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'public-ip-detach',
        message: 'Public IP detached successfully.',
        node_id: 101,
        public_ip: '151.185.42.45'
      })}\n`
    );
  });

  it('renders remaining human delete and upgrade branches', () => {
    const cancelledDeleteOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: true,
        node_id: 102,
        reserve_public_ip_requested: false
      },
      false
    );
    const informativeDeleteOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: false,
        message: 'Queued for deletion',
        node_id: 103,
        reserve_public_ip_requested: false
      },
      false
    );
    const quietDeleteOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: false,
        node_id: 104,
        reserve_public_ip_requested: false
      },
      false
    );
    const cancelledUpgradeOutput = renderNodeResult(
      {
        action: 'upgrade',
        cancelled: true,
        node_id: 105,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'PLAN-CANCELLED'
        }
      },
      false
    );
    const minimalUpgradeOutput = renderNodeResult(
      {
        action: 'upgrade',
        details: {
          location: null,
          new_node_image_id: null,
          old_node_image_id: null,
          vm_id: null
        },
        message: 'Upgrade queued',
        node_id: 106,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'PLAN-MINIMAL'
        }
      },
      false
    );

    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
    expect(informativeDeleteOutput).toContain('Message: Queued for deletion');
    expect(informativeDeleteOutput).not.toContain('Reserved Public IP');
    expect(quietDeleteOutput).not.toContain('Message:');
    expect(cancelledUpgradeOutput).toContain('Node upgrade cancelled.');
    expect(cancelledUpgradeOutput).toContain('Target Plan: PLAN-CANCELLED');
    expect(minimalUpgradeOutput).toContain('Message: Upgrade queued');
    expect(minimalUpgradeOutput).not.toContain('VM ID:');
    expect(minimalUpgradeOutput).not.toContain('Location:');
    expect(minimalUpgradeOutput).not.toContain('Old Node Image ID:');
    expect(minimalUpgradeOutput).not.toContain('New Node Image ID:');
  });

  it('renders deterministic cancelled output for public-ip detach', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'public-ip-detach',
        cancelled: true,
        node_id: 101,
        public_ip: '151.185.42.45'
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'public-ip-detach',
        cancelled: true,
        node_id: 101,
        public_ip: '151.185.42.45'
      },
      true
    );

    expect(humanOutput).toContain('Cancelled public IP detach for node 101.');
    expect(humanOutput).toContain('Public IP: 151.185.42.45');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'public-ip-detach',
        cancelled: true,
        node_id: 101,
        public_ip: '151.185.42.45'
      })}\n`
    );
  });

  it('renders clean human summaries for node upgrade results', () => {
    const output = renderNodeResult(
      {
        action: 'upgrade',
        details: {
          location: 'Delhi',
          new_node_image_id: 8802,
          old_node_image_id: 8801,
          vm_id: 100157
        },
        message: 'Node upgrade initiated',
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
        }
      },
      false
    );

    expect(output).toContain('Requested node upgrade for node 101.');
    expect(output).toContain(
      'Target Plan: C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi'
    );
    expect(output).toContain('Target Image: Ubuntu-24.04-Distro');
    expect(output).toContain('Message: Node upgrade initiated');
    expect(output).toContain('VM ID: 100157');
    expect(output).toContain('Location: Delhi');
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

  it('preserves backend downgrade wording in deterministic node upgrade json', () => {
    const output = renderNodeResult(
      {
        action: 'upgrade',
        details: {
          location: 'Delhi',
          new_node_image_id: 8802,
          old_node_image_id: 8801,
          vm_id: 100157
        },
        message: 'Node downgrade initiated',
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3-2vCPU-4RAM-100DISK-C3.4GB-Ubuntu-24.04-Delhi'
        }
      },
      true
    );

    expect(output).toBe(
      `${stableStringify({
        action: 'upgrade',
        details: {
          location: 'Delhi',
          new_node_image_id: 8802,
          old_node_image_id: 8801,
          vm_id: 100157
        },
        message: 'Node downgrade initiated',
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3-2vCPU-4RAM-100DISK-C3.4GB-Ubuntu-24.04-Delhi'
        }
      })}\n`
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

  it('renders the empty catalog-os branch clearly', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-os',
        catalog: {
          category_list: []
        }
      },
      false
    );

    expect(output).toBe('No OS catalog rows found.\n');
  });

  it('renders the no-family-match catalog-plans branch clearly', () => {
    const output = renderNodeResult(
      {
        action: 'catalog-plans',
        items: [],
        query: {
          billing_type: 'hourly',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          family: 'GPU',
          os: 'Ubuntu',
          osversion: '24.04'
        },
        summary: {
          available_families: ['C3', 'M3'],
          empty_reason: 'no_family_match'
        }
      },
      false
    );

    expect(output).toContain(
      'Filters: OS=Ubuntu 24.04, Billing=hourly, Family=GPU'
    );
    expect(output).toContain('Available Families: C3, M3');
    expect(output).toContain('No configs were found for family GPU.');
  });

  it('renders power-off output for both humans and json', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'power-off',
        node_id: 101,
        result: {
          action_id: 702,
          created_at: '2026-03-14T08:15:00Z',
          image_id: null,
          status: 'In Progress'
        }
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'power-off',
        node_id: 101,
        result: {
          action_id: 702,
          created_at: '2026-03-14T08:15:00Z',
          image_id: null,
          status: 'In Progress'
        }
      },
      true
    );

    expect(humanOutput).toContain('Requested power off for node 101.');
    expect(humanOutput).toContain('Action ID: 702');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'power-off',
        node_id: 101,
        result: {
          action_id: 702,
          created_at: '2026-03-14T08:15:00Z',
          image_id: null,
          status: 'In Progress'
        }
      })}\n`
    );
  });

  it('renders remaining human action branches', () => {
    const securityGroupAttachOutput = renderNodeResult(
      {
        action: 'security-group-attach',
        node_id: 101,
        result: {
          message: 'Security Group Attached Successfully'
        },
        security_group_ids: [44, 45]
      },
      false
    );
    const vpcDetachMinimalOutput = renderNodeResult(
      {
        action: 'vpc-detach',
        node_id: 101,
        result: {
          message: 'VPC detached successfully.',
          project_id: '46429'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: null,
          subnet_id: null
        }
      },
      false
    );
    const emptyListOutput = renderNodeResult(
      {
        action: 'list',
        nodes: [],
        total_count: 0,
        total_page_number: 0
      },
      false
    );

    expect(securityGroupAttachOutput).toContain(
      'Requested security-group attach for node 101.'
    );
    expect(vpcDetachMinimalOutput).toContain(
      'Requested VPC detach for node 101.'
    );
    expect(vpcDetachMinimalOutput).not.toContain('Subnet ID:');
    expect(vpcDetachMinimalOutput).not.toContain('Private IP:');
    expect(emptyListOutput).toBe('No nodes found.\n');
  });

  it('renders save-image output for humans', () => {
    const output = renderNodeResult(
      {
        action: 'save-image',
        image_name: 'node-a-image',
        node_id: 101,
        result: {
          action_id: 703,
          created_at: '2026-03-14T08:20:00Z',
          image_id: 'img-455',
          status: 'In Progress'
        }
      },
      false
    );

    expect(output).toContain(
      'Requested save image for node 101 as node-a-image.'
    );
    expect(output).toContain('Image ID: img-455');
  });

  it('renders remaining deterministic json branches', () => {
    const deleteJsonOutput = renderNodeResult(
      {
        action: 'delete',
        cancelled: false,
        node_id: 101,
        reserve_public_ip_requested: false
      },
      true
    );
    const listJsonOutput = renderNodeResult(
      {
        action: 'list',
        nodes: []
      },
      true
    );
    const cancelledUpgradeJsonOutput = renderNodeResult(
      {
        action: 'upgrade',
        cancelled: true,
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'PLAN-CANCELLED'
        }
      },
      true
    );
    const volumeAttachJsonOutput = renderNodeResult(
      {
        action: 'volume-attach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage attach queued.'
        },
        volume: {
          id: 8801
        }
      },
      true
    );
    const vpcDetachJsonOutput = renderNodeResult(
      {
        action: 'vpc-detach',
        node_id: 101,
        result: {
          message: 'VPC detached successfully.',
          project_id: null
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: null,
          subnet_id: null
        }
      },
      true
    );

    expect(deleteJsonOutput).toBe(
      `${stableStringify({
        action: 'delete',
        cancelled: false,
        message: '',
        node_id: 101,
        reserve_public_ip_requested: false
      })}\n`
    );
    expect(listJsonOutput).toBe(
      `${stableStringify({
        action: 'list',
        nodes: [],
        total_count: null,
        total_page_number: null
      })}\n`
    );
    expect(cancelledUpgradeJsonOutput).toBe(
      `${stableStringify({
        action: 'upgrade',
        cancelled: true,
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'PLAN-CANCELLED'
        }
      })}\n`
    );
    expect(volumeAttachJsonOutput).toBe(
      `${stableStringify({
        action: 'volume-attach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage attach queued.'
        },
        volume: {
          id: 8801
        }
      })}\n`
    );
    expect(vpcDetachJsonOutput).toBe(
      `${stableStringify({
        action: 'vpc-detach',
        node_id: 101,
        result: {
          message: 'VPC detached successfully.',
          project_id: null
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: null,
          subnet_id: null
        }
      })}\n`
    );
  });

  it('renders security-group action output for both humans and json', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'security-group-detach',
        node_id: 101,
        result: {
          message: 'Security Groups Detached Successfully'
        },
        security_group_ids: [44, 45]
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'security-group-attach',
        node_id: 101,
        result: {
          message: 'Security Group Attached Successfully'
        },
        security_group_ids: [44, 45]
      },
      true
    );

    expect(humanOutput).toContain(
      'Requested security-group detach for node 101.'
    );
    expect(humanOutput).toContain('Security Group IDs: 44, 45');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'security-group-attach',
        node_id: 101,
        result: {
          message: 'Security Group Attached Successfully'
        },
        security_group_ids: [44, 45]
      })}\n`
    );
  });

  it('renders volume action output for both humans and json', () => {
    const humanOutput = renderNodeResult(
      {
        action: 'volume-attach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage is Attached to VM.'
        },
        volume: {
          id: 8801
        }
      },
      false
    );
    const jsonOutput = renderNodeResult(
      {
        action: 'volume-detach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage Detach Process is Started.'
        },
        volume: {
          id: 8801
        }
      },
      true
    );

    expect(humanOutput).toContain('Requested volume attach for node 101.');
    expect(humanOutput).toContain('Volume ID: 8801');
    expect(jsonOutput).toBe(
      `${stableStringify({
        action: 'volume-detach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'Block Storage Detach Process is Started.'
        },
        volume: {
          id: 8801
        }
      })}\n`
    );
  });

  it('renders VPC action output for both subnet-free and subnet-aware branches', () => {
    const attachOutput = renderNodeResult(
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
          private_ip: null,
          subnet_id: null
        }
      },
      false
    );
    const detachOutput = renderNodeResult(
      {
        action: 'vpc-detach',
        node_id: 101,
        result: {
          message: 'VPC detached successfully.',
          project_id: '46429'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: '10.0.0.25',
          subnet_id: 991
        }
      },
      false
    );

    expect(attachOutput).toContain('Requested VPC attach for node 101.');
    expect(attachOutput).not.toContain('Subnet ID:');
    expect(attachOutput).not.toContain('Private IP:');
    expect(detachOutput).toContain('Requested VPC detach for node 101.');
    expect(detachOutput).toContain('Subnet ID: 991');
    expect(detachOutput).toContain('Private IP: 10.0.0.25');
  });
});
