import { formatCliCommand } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import {
  formatDbaasEnginePlansTable,
  formatDbaasListTable,
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
    const engineTable = formatDbaasEnginePlansTable([
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

    expect(engineTable).toContain('Relational');
    expect(engineTable).toContain('301');
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
        action: 'plans',
        filters: {
          type: null,
          version: null
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
        mode: 'engines',
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
        mode: 'templates',
        total_count: 1
      },
      false
    );

    expect(engineOutput).toContain('Supported DBaaS engines (1)');
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
});
