import {
  formatNodeCatalogOsTable,
  formatNodeCatalogPlansTable,
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

  it('renders plan and image catalog rows for human selection', () => {
    const table = formatNodeCatalogPlansTable([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        location: 'Delhi',
        name: 'C3.8GB',
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        specs: {
          cpu: 4,
          disk_space: 100,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3'
        }
      }
    ]);

    expect(table).toContain('Ubuntu-24.04-Distro');
    expect(table).toContain('2263 INR');
    expect(table).toContain('C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi');
  });
});
