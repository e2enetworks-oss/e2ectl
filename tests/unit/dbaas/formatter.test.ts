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
        database_name: 'appdb',
        id: 7869,
        name: 'customer-db',
        status: 'Running',
        type: 'MySQL',
        version: '8.0'
      }
    ]);

    expect(table).toContain('customer-db');
    expect(table).toContain('MySQL 8.0');
    expect(table).toContain('appdb');
    expect(table).toContain('mysql -h db.example.com');
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

    expect(output).toContain('Created DBaaS: customer-db');
    expect(output).toContain('DB Version: MySQL 8.0');
    expect(output).toContain('Connection String: mysql -h db.example.com');
    expect(output).toContain(formatCliCommand('dbaas list'));
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
        mode: 'templates',
        total_count: 0
      },
      false
    );

    expect(output).toContain('No DBaaS plans found.');
  });
});
