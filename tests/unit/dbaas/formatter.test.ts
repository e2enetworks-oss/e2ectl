import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import {
  formatDbaasListTable,
  formatDbaasListTypesTable,
  formatDbaasTemplatePlansTable,
  renderDbaasResult
} from '../../../src/dbaas/formatter.js';

describe('dbaas formatter', () => {
  it('renders stable DBaaS list tables', () => {
    const table = formatDbaasListTable([
      {
        connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
        connection_endpoint: 'db.example.com (1.2.3.4)',
        connection_port: '3306',
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        private_ips: ['10.0.0.1'],
        public_ip: '1.2.3.4',
        status: 'Running',
        type: 'MySQL',
        version: '8.0'
      }
    ]);

    expect(table).toContain('customer-db');
    expect(table).toContain('MySQL 8.0');
    expect(table).toContain('db.example.com (1.2.3.4)');
    expect(table).toContain('3306');
    expect(table).toContain('Running');
  });

  it('renders engine and template plan tables', () => {
    const engineTable = formatDbaasListTypesTable([
      {
        description: null,
        engine: 'Relational',
        software_id: 301,
        type: 'MySQL',
        version: '8.0'
      }
    ]);
    const templateTable = formatDbaasTemplatePlansTable([
      {
        available: true,
        committed_sku: [],
        currency: 'INR',
        disk: '100 GB',
        name: 'General Purpose Small',
        price_per_hour: 12,
        ram: '4',
        template_id: 901,
        type: 'MySQL',
        vcpu: '2',
        version: '8.0'
      }
    ]);

    expect(engineTable).toContain('MySQL');
    expect(engineTable).toContain('8.0');
    expect(templateTable).toContain('General Purpose Small');
    expect(templateTable).toContain('901');
    expect(templateTable).toContain('12 INR');
  });

  it('renders create output with DB version and connection string', () => {
    const output = renderDbaasResult(
      {
        action: 'create',
        dbaas: {
          connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        requested: {
          billing_type: 'hourly',
          database_name: 'appdb',
          name: 'customer-db',
          plan: 'General Purpose Small',
          public_ip: true,
          template_id: 901,
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        }
      },
      false
    );

    expect(output).toContain('customer-db');
    expect(output).toContain('MySQL 8.0');
    expect(output).toContain('appdb');
    expect(output).toContain('hourly');
  });

  it('renders detailed DBaaS get output with plan, configuration, and network details', () => {
    const output = renderDbaasResult(
      {
        action: 'get',
        dbaas: {
          connection_endpoint: 'db.example.com (1.2.3.4)',
          connection_port: '3306',
          connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
          created_at: '2026-04-24T12:00:00.000Z',
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          plan: {
            configuration: {
              cpu: '4',
              disk: '100 GB',
              ram: '16 GB'
            },
            name: 'DBS.16GB',
            price: '150 INR',
            price_per_hour: '5',
            price_per_month: '3600'
          },
          public_ip: {
            attached: true,
            enabled: true,
            ip_address: '1.2.3.4'
          },
          status: 'Running',
          type: 'MySQL',
          username: 'admin',
          version: '8.0',
          vpc_connections: [
            {
              appliance_id: 7869,
              ip_address: '10.40.0.8',
              subnet_id: 44,
              vpc_cidr: '10.40.0.0/16',
              vpc_id: 501,
              vpc_name: 'app-vpc'
            }
          ],
          whitelisted_ips: [
            {
              ip: '203.0.113.10',
              tags: [{ id: 7, name: 'office' }]
            }
          ]
        }
      },
      false
    );

    expect(output).toContain('DBS.16GB');
    expect(output).toContain('150 INR');
    expect(output).toContain('4 vCPU, 16 GB RAM, 100 GB disk');
    expect(output).toContain('app-vpc');
    expect(output).toContain('203.0.113.10');
  });

  it('renders DBaaS network and whitelist actions in json mode', () => {
    const detachJson = renderDbaasResult(
      {
        action: 'public-ip-detach',
        cancelled: false,
        dbaas_id: 7869,
        message: 'Public IP detach initiated.'
      },
      true
    );

    expect(JSON.parse(detachJson)).toEqual({
      action: 'public-ip-detach',
      cancelled: false,
      dbaas_id: 7869,
      message: 'Public IP detach initiated.'
    });
  });

  it('renders plans guidance for both engine discovery and template selection', () => {
    const engineOutput = renderDbaasResult(
      {
        action: 'list-types',
        filters: {
          type: null
        },
        items: [
          {
            description: null,
            engine: 'Relational',
            software_id: 401,
            type: 'PostgreSQL',
            version: '16'
          }
        ],
        total_count: 1
      },
      false
    );
    const templateOutput = renderDbaasResult(
      {
        action: 'plans',
        filters: {
          type: 'PostgreSQL',
          version: '16'
        },
        items: [
          {
            available: true,
            committed_sku: [],
            currency: 'INR',
            disk: '100 GB',
            name: 'Balanced Small',
            price_per_hour: 18,
            ram: '8',
            template_id: 990,
            type: 'PostgreSQL',
            vcpu: '2',
            version: '16'
          }
        ],
        total_count: 1
      },
      false
    );

    expect(engineOutput).toContain('Supported DBaaS engine types (1)');
    expect(engineOutput).toContain(
      formatCliCommand(
        'dbaas plans --type <database-type> --db-version <version>'
      )
    );
    expect(templateOutput).toContain('Plans for PostgreSQL 16 (1)');
    expect(templateOutput).toContain('Balanced Small');
    expect(templateOutput).toContain(
      formatCliCommand(
        'dbaas create --name <name> --type <database-type> --db-version <version> --plan <plan-name> --database-name <database-name> --password-file <path>'
      )
    );
  });

  it('renders empty lists, cancelled deletes, and deterministic json', () => {
    const emptyListOutput = renderDbaasResult(
      {
        action: 'list',
        filters: {
          type: null
        },
        items: [],
        total_count: 0,
        total_page_number: 0
      },
      false
    );
    const cancelledDeleteOutput = renderDbaasResult(
      {
        action: 'delete',
        cancelled: true,
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        dbaas_id: 7869
      },
      false
    );
    const resetPasswordJson = renderDbaasResult(
      {
        action: 'reset-password',
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        message: 'Password reset request processed successfully.'
      },
      true
    );

    expect(emptyListOutput).toBe('No supported DBaaS clusters found.\n');
    expect(cancelledDeleteOutput).toBe('Deletion cancelled.\n');
    expect(resetPasswordJson).toBe(
      `${stableStringify({
        action: 'reset-password',
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        message: 'Password reset request processed successfully.'
      })}\n`
    );
  });

  it('renders non-cancelled delete output with and without a cluster summary', () => {
    const deletedWithSummary = renderDbaasResult(
      {
        action: 'delete',
        cancelled: false,
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        dbaas_id: 7869,
        message: 'Deleted customer-db.'
      },
      false
    );
    const deletedWithoutSummary = renderDbaasResult(
      {
        action: 'delete',
        cancelled: false,
        dbaas: null,
        dbaas_id: 7869
      },
      false
    );

    expect(deletedWithSummary).toBe(
      'Deleted DBaaS 7869 (customer-db, MySQL 8.0).\n'
    );
    expect(deletedWithoutSummary).toBe('Deleted DBaaS 7869.\n');
  });

  it('renders list-types in json mode', () => {
    const json = renderDbaasResult(
      {
        action: 'list-types',
        filters: {
          type: null
        },
        items: [
          {
            description: 'Relational DB',
            engine: 'Relational',
            software_id: 401,
            type: 'PostgreSQL',
            version: '16'
          }
        ],
        total_count: 1
      },
      true
    );

    const parsed = JSON.parse(json) as {
      action: string;
      items: Array<{ software_id: number; engine: string }>;
    };
    expect(parsed.action).toBe('list-types');
    expect(parsed.items[0]?.software_id).toBe(401);
    expect(parsed.items[0]?.engine).toBe('Relational');
  });

  it('renders template plans in json mode', () => {
    const json = renderDbaasResult(
      {
        action: 'plans',
        filters: {
          type: 'PostgreSQL',
          version: '16'
        },
        items: [
          {
            available: true,
            committed_sku: [],
            currency: null,
            disk: '100 GB',
            name: 'Balanced Small',
            price_per_hour: null,
            ram: '8',
            template_id: 990,
            type: 'PostgreSQL',
            vcpu: '2',
            version: '16'
          }
        ],
        total_count: 1
      },
      true
    );

    const parsed = JSON.parse(json) as {
      action: string;
      items: Array<{ available: boolean; price_per_hour: null }>;
    };
    expect(parsed.action).toBe('plans');
    expect(parsed.items[0]?.available).toBe(true);
    expect(parsed.items[0]?.price_per_hour).toBeNull();
  });

  it('renders reset-password output in human mode', () => {
    const output = renderDbaasResult(
      {
        action: 'reset-password',
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        message: 'Password reset request processed successfully.'
      },
      false
    );

    expect(output).toContain('Password Reset');
    expect(output).toContain('customer-db');
    expect(output).toContain('admin');
    expect(output).toContain('Password reset request processed successfully.');
  });

  it('renders vpc-attach and vpc-detach in human mode', () => {
    const attachOutput = renderDbaasResult(
      {
        action: 'vpc-attach',
        dbaas_id: 7869,
        vpc: { id: 501, name: 'app-vpc', subnet_id: null }
      },
      false
    );
    const attachWithSubnet = renderDbaasResult(
      {
        action: 'vpc-attach',
        dbaas_id: 7869,
        vpc: { id: 501, name: 'app-vpc', subnet_id: 44 }
      },
      false
    );
    const detachOutput = renderDbaasResult(
      {
        action: 'vpc-detach',
        dbaas_id: 7869,
        message: 'VPC detach initiated.',
        vpc: { id: 501, name: 'app-vpc', subnet_id: null }
      },
      false
    );
    const detachWithSubnet = renderDbaasResult(
      {
        action: 'vpc-detach',
        dbaas_id: 7869,
        message: null,
        vpc: { id: 501, name: 'app-vpc', subnet_id: 44 }
      },
      false
    );

    expect(attachOutput).toContain('Attached VPC 501 (app-vpc) to DBaaS 7869.');
    expect(attachOutput).not.toContain('Subnet ID:');
    expect(attachWithSubnet).toContain('Subnet ID: 44');
    expect(detachOutput).toContain(
      'Detached VPC 501 (app-vpc) from DBaaS 7869.'
    );
    expect(detachOutput).toContain('VPC detach initiated.');
    expect(detachWithSubnet).toContain('Subnet ID: 44');
    expect(detachWithSubnet).not.toContain('Message:');
  });

  it('renders vpc-attach and vpc-detach in json mode', () => {
    const attachJson = JSON.parse(
      renderDbaasResult(
        {
          action: 'vpc-attach',
          dbaas_id: 7869,
          vpc: { id: 501, name: 'app-vpc', subnet_id: 44 }
        },
        true
      )
    ) as { action: string; dbaas_id: number; vpc: { id: number } };

    const detachJson = JSON.parse(
      renderDbaasResult(
        {
          action: 'vpc-detach',
          dbaas_id: 7869,
          message: 'VPC detach initiated.',
          vpc: { id: 501, name: 'app-vpc', subnet_id: null }
        },
        true
      )
    ) as { action: string; message: string };

    expect(attachJson.action).toBe('vpc-attach');
    expect(attachJson.dbaas_id).toBe(7869);
    expect(attachJson.vpc.id).toBe(501);
    expect(detachJson.action).toBe('vpc-detach');
    expect(detachJson.message).toBe('VPC detach initiated.');
  });

  it('renders public-ip-attach in human mode with and without message', () => {
    const withMessage = renderDbaasResult(
      {
        action: 'public-ip-attach',
        dbaas_id: 7869,
        message: 'IP attach queued.'
      },
      false
    );
    const withoutMessage = renderDbaasResult(
      { action: 'public-ip-attach', dbaas_id: 7869, message: null },
      false
    );

    expect(withMessage).toContain('Public IP attach requested for DBaaS 7869.');
    expect(withMessage).toContain('IP attach queued.');
    expect(withoutMessage).toContain(
      'Public IP attach requested for DBaaS 7869.'
    );
    expect(withoutMessage).not.toContain('Message:');
  });

  it('renders whitelist-list with items and empty in human mode', () => {
    const withItems = renderDbaasResult(
      {
        action: 'whitelist-list',
        dbaas_id: 7869,
        items: [{ ip: '203.0.113.10', tags: [] }],
        total_count: 1
      },
      false
    );
    const empty = renderDbaasResult(
      { action: 'whitelist-list', dbaas_id: 7869, items: [], total_count: 0 },
      false
    );

    expect(withItems).toContain('203.0.113.10');
    expect(empty).toBe('No whitelisted IPs found for DBaaS 7869.\n');
  });

  it('renders whitelist-list in json mode', () => {
    const json = JSON.parse(
      renderDbaasResult(
        {
          action: 'whitelist-list',
          dbaas_id: 7869,
          items: [{ ip: '203.0.113.10', tags: [{ id: 7, name: 'office' }] }],
          total_count: 1
        },
        true
      )
    ) as { action: string; items: Array<{ ip: string }> };

    expect(json.action).toBe('whitelist-list');
    expect(json.items[0]?.ip).toBe('203.0.113.10');
  });

  it('renders whitelist-add and whitelist-remove in human mode', () => {
    const addOutput = renderDbaasResult(
      {
        action: 'whitelist-add',
        dbaas_id: 7869,
        ip: '203.0.113.10',
        message: 'IP whitelisting in progress.',
        tag_ids: []
      },
      false
    );
    const removeOutput = renderDbaasResult(
      {
        action: 'whitelist-remove',
        dbaas_id: 7869,
        ip: '203.0.113.10',
        message: null,
        tag_ids: []
      },
      false
    );

    expect(addOutput).toContain('Whitelisted IP 203.0.113.10 for DBaaS 7869.');
    expect(addOutput).toContain('IP whitelisting in progress.');
    expect(removeOutput).toContain(
      'Removed whitelisted IP 203.0.113.10 from DBaaS 7869.'
    );
    expect(removeOutput).not.toContain('Message:');
  });

  it('renders whitelist-add and whitelist-remove in json mode', () => {
    const addJson = JSON.parse(
      renderDbaasResult(
        {
          action: 'whitelist-add',
          dbaas_id: 7869,
          ip: '203.0.113.10',
          message: 'IP whitelisting in progress.',
          tag_ids: [7]
        },
        true
      )
    ) as { action: string; ip: string; tag_ids: number[] };

    expect(addJson.action).toBe('whitelist-add');
    expect(addJson.ip).toBe('203.0.113.10');
    expect(addJson.tag_ids).toEqual([7]);
  });

  it('renders get output in json mode covering normalizeDetailJson', () => {
    const json = JSON.parse(
      renderDbaasResult(
        {
          action: 'get',
          dbaas: {
            connection_endpoint: 'db.example.com (1.2.3.4)',
            connection_port: '3306',
            connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
            created_at: '2026-04-24T12:00:00.000Z',
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            plan: {
              configuration: { cpu: '4', disk: '100 GB', ram: '16 GB' },
              name: 'DBS.16GB',
              price: '150 INR',
              price_per_hour: '5',
              price_per_month: '3600'
            },
            public_ip: { attached: true, enabled: true, ip_address: '1.2.3.4' },
            status: 'Running',
            type: 'MySQL',
            username: 'admin',
            version: '8.0',
            vpc_connections: [
              {
                appliance_id: 7869,
                ip_address: '10.40.0.8',
                subnet_id: 44,
                vpc_cidr: '10.40.0.0/16',
                vpc_id: 501,
                vpc_name: 'app-vpc'
              }
            ],
            whitelisted_ips: [
              { ip: '203.0.113.10', tags: [{ id: 7, name: 'office' }] }
            ]
          }
        },
        true
      )
    ) as {
      action: string;
      dbaas: {
        name: string;
        plan: { name: string };
        vpc_connections: Array<{ vpc_name: string }>;
        whitelisted_ips: Array<{ ip: string }>;
      };
    };

    expect(json.action).toBe('get');
    expect(json.dbaas.name).toBe('customer-db');
    expect(json.dbaas.plan.name).toBe('DBS.16GB');
    expect(json.dbaas.vpc_connections[0]?.vpc_name).toBe('app-vpc');
    expect(json.dbaas.whitelisted_ips[0]?.ip).toBe('203.0.113.10');
  });

  it('renders get output with empty vpc and whitelist sections', () => {
    const output = renderDbaasResult(
      {
        action: 'get',
        dbaas: {
          connection_endpoint: null,
          connection_port: null,
          connection_string: null,
          created_at: null,
          database_name: null,
          id: 7869,
          name: 'customer-db',
          plan: {
            configuration: { cpu: null, disk: null, ram: null },
            name: null,
            price: null,
            price_per_hour: null,
            price_per_month: null
          },
          public_ip: { attached: false, enabled: false, ip_address: null },
          status: null,
          type: 'MySQL',
          username: null,
          version: '8.0',
          vpc_connections: [],
          whitelisted_ips: []
        }
      },
      false
    );

    expect(output).toContain('VPC Connections: none');
    expect(output).toContain('Whitelisted IPs: none');
    expect(output).toContain('--');
  });

  it('renders create with committed_plan_id and vpc_id in json mode', () => {
    const json = JSON.parse(
      renderDbaasResult(
        {
          action: 'create',
          dbaas: {
            connection_string: null,
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            type: 'MySQL',
            username: 'admin',
            version: '8.0'
          },
          requested: {
            billing_type: 'committed',
            committed_plan_id: 999,
            database_name: 'appdb',
            name: 'customer-db',
            plan: 'DBS.16GB',
            public_ip: true,
            template_id: 901,
            type: 'MySQL',
            username: 'admin',
            version: '8.0',
            vpc_id: 4328
          }
        },
        true
      )
    ) as {
      action: string;
      requested: { committed_plan_id: number; vpc_id: number };
    };

    expect(json.action).toBe('create');
    expect(json.requested.committed_plan_id).toBe(999);
    expect(json.requested.vpc_id).toBe(4328);
  });

  it('renders public-ip-detach cancelled in human mode', () => {
    const cancelled = renderDbaasResult(
      {
        action: 'public-ip-detach',
        cancelled: true,
        dbaas_id: 7869,
        message: null
      },
      false
    );
    expect(cancelled).toBe('Public IP detach cancelled.\n');
  });

  it('formats template plan prices as empty string when price is null', () => {
    const table = formatDbaasTemplatePlansTable([
      {
        available: true,
        committed_sku: [],
        currency: null,
        disk: '50 GB',
        name: 'Free Tier',
        price_per_hour: null,
        ram: '2',
        template_id: 1,
        type: 'MySQL',
        vcpu: '1',
        version: '8.0'
      }
    ]);

    expect(table).toContain('Free Tier');
    expect(table).not.toContain('null');
  });

  it('renders empty list-types output', () => {
    const output = renderDbaasResult(
      {
        action: 'list-types',
        filters: {
          type: null
        },
        items: [],
        total_count: 0
      },
      false
    );

    expect(output).toBe('No supported DBaaS engine types found.\n');
  });

  it('renders empty template plans output', () => {
    const output = renderDbaasResult(
      {
        action: 'plans',
        filters: {
          type: 'PostgreSQL',
          version: '16'
        },
        items: [],
        total_count: 0
      },
      false
    );

    expect(output).toContain('No DBaaS plans found.');
  });

  it('renders create human output with committed_plan_id and vpc_id rows', () => {
    const output = renderDbaasResult(
      {
        action: 'create',
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: 'admin',
          version: '8.0'
        },
        requested: {
          billing_type: 'committed',
          committed_plan_id: 999,
          database_name: 'appdb',
          name: 'customer-db',
          plan: 'DBS.16GB',
          public_ip: true,
          template_id: 901,
          type: 'MySQL',
          username: 'admin',
          version: '8.0',
          vpc_id: 4328
        }
      },
      false
    );

    expect(output).toContain('Committed Plan ID');
    expect(output).toContain('999');
    expect(output).toContain('VPC ID');
    expect(output).toContain('4328');
  });

  it('renders plans human output with non-empty committed SKUs', () => {
    const output = renderDbaasResult(
      {
        action: 'plans',
        filters: { type: 'MySQL', version: '8.0' },
        items: [
          {
            available: true,
            committed_sku: [
              {
                committed_days: 365,
                committed_sku_id: 101,
                committed_sku_name: 'DBS.16GB.1Y',
                committed_sku_price: 3000,
                currency: 'INR',
                plan_name: 'DBS.16GB',
                template_id: 901
              }
            ],
            currency: 'INR',
            disk: '100 GB',
            name: 'DBS.16GB',
            price_per_hour: 12,
            ram: '16',
            template_id: 901,
            type: 'MySQL',
            vcpu: '4',
            version: '8.0'
          }
        ],
        total_count: 1
      },
      false
    );

    expect(output).toContain('DBS.16GB');
    expect(output).toContain('Committed SKU options');
    expect(output).toContain('101');
    expect(output).toContain('365 days');
  });

  it('renders get output with vpc connection having null subnet_id', () => {
    const output = renderDbaasResult(
      {
        action: 'get',
        dbaas: {
          connection_endpoint: 'db.example.com',
          connection_port: '3306',
          connection_string: null,
          created_at: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          plan: {
            configuration: { cpu: null, disk: null, ram: null },
            name: null,
            price: null,
            price_per_hour: null,
            price_per_month: null
          },
          public_ip: { attached: false, enabled: false, ip_address: null },
          status: 'Running',
          type: 'MySQL',
          username: 'admin',
          version: '8.0',
          vpc_connections: [
            {
              appliance_id: 7869,
              ip_address: '10.40.0.8',
              subnet_id: null,
              vpc_cidr: '10.40.0.0/16',
              vpc_id: 501,
              vpc_name: 'app-vpc'
            }
          ],
          whitelisted_ips: []
        }
      },
      false
    );

    expect(output).toContain('app-vpc');
    expect(output).toContain('--');
  });

  it('renders delete json output with null dbaas and message', () => {
    const withNull = JSON.parse(
      renderDbaasResult(
        {
          action: 'delete',
          cancelled: false,
          dbaas: null,
          dbaas_id: 7869,
          message: 'Deleted.'
        },
        true
      )
    ) as { action: string; dbaas: null; message: string };
    const withoutMessage = JSON.parse(
      renderDbaasResult(
        {
          action: 'delete',
          cancelled: true,
          dbaas: {
            connection_string: null,
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            type: 'MySQL',
            username: 'admin',
            version: '8.0'
          },
          dbaas_id: 7869
        },
        true
      )
    ) as { action: string; cancelled: boolean };

    expect(withNull.dbaas).toBeNull();
    expect(withNull.message).toBe('Deleted.');
    expect(withoutMessage.cancelled).toBe(true);
  });

  it('formats template plan price with non-null amount and null currency', () => {
    const table = formatDbaasTemplatePlansTable([
      {
        available: true,
        committed_sku: [],
        currency: null,
        disk: '50 GB',
        name: 'Basic',
        price_per_hour: 5,
        ram: '2',
        template_id: 1,
        type: 'MySQL',
        vcpu: '1',
        version: '8.0'
      }
    ]);

    expect(table).toContain('5');
    expect(table).not.toContain('null');
  });

  it('renders whitelist-add with null message and whitelist-remove with message', () => {
    const addNoMessage = renderDbaasResult(
      {
        action: 'whitelist-add',
        dbaas_id: 7869,
        ip: '10.0.0.1',
        message: null,
        tag_ids: []
      },
      false
    );
    const removeWithMessage = renderDbaasResult(
      {
        action: 'whitelist-remove',
        dbaas_id: 7869,
        ip: '10.0.0.1',
        message: 'IP removed.',
        tag_ids: []
      },
      false
    );

    expect(addNoMessage).not.toContain('Message:');
    expect(removeWithMessage).toContain('IP removed.');
  });

  it('renders public-ip-detach non-cancelled with and without message in human mode', () => {
    const withMessage = renderDbaasResult(
      {
        action: 'public-ip-detach',
        cancelled: false,
        dbaas_id: 7869,
        message: 'Detach queued.'
      },
      false
    );
    const withoutMessage = renderDbaasResult(
      {
        action: 'public-ip-detach',
        cancelled: false,
        dbaas_id: 7869,
        message: null
      },
      false
    );

    expect(withMessage).toContain('Public IP detach requested for DBaaS 7869.');
    expect(withMessage).toContain('Detach queued.');
    expect(withoutMessage).toContain(
      'Public IP detach requested for DBaaS 7869.'
    );
    expect(withoutMessage).not.toContain('Message:');
  });

  it('renders get output with all-null vpc connection fields', () => {
    const output = renderDbaasResult(
      {
        action: 'get',
        dbaas: {
          connection_endpoint: null,
          connection_port: null,
          connection_string: null,
          created_at: null,
          database_name: null,
          id: 7869,
          name: 'test-db',
          plan: {
            configuration: { cpu: null, disk: null, ram: null },
            name: null,
            price: null,
            price_per_hour: null,
            price_per_month: null
          },
          public_ip: { attached: false, enabled: false, ip_address: null },
          status: null,
          type: 'MySQL',
          username: null,
          version: '8.0',
          vpc_connections: [
            {
              appliance_id: 1,
              ip_address: null,
              subnet_id: null,
              vpc_cidr: null,
              vpc_id: null,
              vpc_name: null
            }
          ],
          whitelisted_ips: []
        }
      },
      false
    );

    expect(output).toContain('--');
  });

  it('renders list-types output with non-null type filter', () => {
    const output = renderDbaasResult(
      {
        action: 'list-types',
        filters: { type: 'MySQL' },
        items: [
          {
            description: null,
            engine: 'Relational',
            software_id: 301,
            type: 'MySQL',
            version: '8.0'
          }
        ],
        total_count: 1
      },
      false
    );

    expect(output).toContain('Supported MySQL versions (1)');
  });

  it('renders plans json output with non-empty committed_sku array', () => {
    const json = JSON.parse(
      renderDbaasResult(
        {
          action: 'plans',
          filters: { type: 'MySQL', version: '8.0' },
          items: [
            {
              available: true,
              committed_sku: [
                {
                  committed_days: 365,
                  committed_sku_id: 101,
                  committed_sku_name: 'DBS.16GB.1Y',
                  committed_sku_price: 3000,
                  currency: 'INR',
                  plan_name: 'DBS.16GB',
                  template_id: 901
                }
              ],
              currency: 'INR',
              disk: '100 GB',
              name: 'DBS.16GB',
              price_per_hour: 12,
              ram: '16',
              template_id: 901,
              type: 'MySQL',
              vcpu: '4',
              version: '8.0'
            }
          ],
          total_count: 1
        },
        true
      )
    ) as {
      action: string;
      items: Array<{
        committed_sku: Array<{
          committed_sku_id: number;
          committed_days: number;
        }>;
      }>;
    };

    expect(json.action).toBe('plans');
    expect(json.items[0]?.committed_sku[0]?.committed_sku_id).toBe(101);
    expect(json.items[0]?.committed_sku[0]?.committed_days).toBe(365);
  });

  it('renders reset-password output with null username as --', () => {
    const output = renderDbaasResult(
      {
        action: 'reset-password',
        dbaas: {
          connection_string: null,
          database_name: 'appdb',
          id: 7869,
          name: 'customer-db',
          type: 'MySQL',
          username: null,
          version: '8.0'
        },
        message: 'Password reset request processed successfully.'
      },
      false
    );

    expect(output).toContain('Password Reset');
    expect(output).toContain('--');
  });
});
