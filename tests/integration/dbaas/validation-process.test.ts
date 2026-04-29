import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dbaas validation through the built CLI', () => {
  it('rejects unsupported database types before making network calls', async () => {
    const result = await runBuiltCli([
      'dbaas',
      'create',
      '--name',
      'customer-db',
      '--type',
      'mongodb',
      '--db-version',
      '8.0',
      '--plan',
      'Small',
      '--database-name',
      'appdb',
      '--password',
      'ValidPassword1!A'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Unsupported database type "mongodb".\n\nNext step: Use one of: maria, sql, postgres.\n'
    );
  });

  it('rejects invalid DBaaS passwords before making network calls', async () => {
    const result = await runBuiltCli([
      'dbaas',
      'create',
      '--name',
      'customer-db',
      '--type',
      'sql',
      '--db-version',
      '8.0',
      '--plan',
      'Small',
      '--database-name',
      'appdb',
      '--password',
      'short'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Password must be 16-30 characters and include uppercase, lowercase, numeric, and special characters.\n\nNext step: Retry with a password that matches the MyAccount DBaaS password policy.\n'
    );
  });

  it('rejects public IP creation flags unless DBaaS creation also attaches a VPC', async () => {
    const noPublicIpResult = await runBuiltCli([
      'dbaas',
      'create',
      '--name',
      'customer-db',
      '--type',
      'sql',
      '--db-version',
      '8.0',
      '--plan',
      'Small',
      '--database-name',
      'appdb',
      '--password',
      'ValidPassword1!A',
      '--no-public-ip'
    ]);
    const publicIpResult = await runBuiltCli([
      'dbaas',
      'create',
      '--name',
      'customer-db',
      '--type',
      'sql',
      '--db-version',
      '8.0',
      '--plan',
      'Small',
      '--database-name',
      'appdb',
      '--password',
      'ValidPassword1!A',
      '--public-ip'
    ]);

    expect(noPublicIpResult.exitCode).toBe(2);
    expect(noPublicIpResult.stdout).toBe('');
    expect(noPublicIpResult.stderr).toBe(
      'Error: DBaaS public IP creation flags can only be used with --vpc-id.\n\nNext step: Attach the DBaaS to a VPC with --vpc-id before choosing --public-ip or --no-public-ip.\n'
    );
    expect(publicIpResult.exitCode).toBe(2);
    expect(publicIpResult.stdout).toBe('');
    expect(publicIpResult.stderr).toBe(
      'Error: DBaaS public IP creation flags can only be used with --vpc-id.\n\nNext step: Attach the DBaaS to a VPC with --vpc-id before choosing --public-ip or --no-public-ip.\n'
    );
  });

  it('rejects dbaas plans --db-version without --type', async () => {
    const result = await runBuiltCli(['dbaas', 'plans', '--db-version', '16']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--type <databaseType>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('fails clearly when the requested plan name does not exist for a supported engine version', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/plans/': (request) => ({
        body: {
          code: 200,
          data:
            request.query.software_id === '301'
              ? {
                  database_engines: [],
                  template_plans: [
                    {
                      available_inventory_status: true,
                      cpu: '2',
                      currency: 'INR',
                      disk: '100 GB',
                      name: 'General Purpose Small',
                      price_per_hour: 12,
                      ram: '4',
                      software: {
                        engine: 'Relational',
                        id: 301,
                        name: 'MySQL',
                        version: '8.0'
                      },
                      template_id: 901
                    }
                  ]
                }
              : {
                  database_engines: [
                    {
                      engine: 'Relational',
                      id: 301,
                      name: 'MySQL',
                      version: '8.0'
                    }
                  ],
                  template_plans: []
                },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'dbaas',
          'create',
          '--name',
          'customer-db',
          '--type',
          'sql',
          '--db-version',
          '8.0',
          '--plan',
          'Unknown Plan',
          '--database-name',
          'appdb',
          '--password',
          'ValidPassword1!A'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: No DBaaS plan matches "Unknown Plan".\n\nNext step: Run dbaas plans with the same --type and --db-version values, then retry with one of the listed plan names.\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
