import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

const BASE_CREATE_ARGS = [
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
  'ValidPassword1!A'
];

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

  it.each([
    {
      args: [...BASE_CREATE_ARGS, '--billing-type', 'committed'],
      stderr:
        'Error: Committed plan ID is required when --billing-type committed is used.\n\nNext step: Pass a committed SKU ID with --committed-plan-id.\n'
    },
    {
      args: [...BASE_CREATE_ARGS, '--committed-plan-id', '9901'],
      stderr:
        'Error: --committed-plan-id can only be used with --billing-type committed.\n\nNext step: Remove --committed-plan-id, or add --billing-type committed.\n'
    },
    {
      args: [...BASE_CREATE_ARGS, '--subnet-id', '44'],
      stderr:
        'Error: --subnet-id can only be used with --vpc-id.\n\nNext step: Remove --subnet-id, or add --vpc-id to attach the DBaaS to a VPC during creation.\n'
    },
    {
      args: [
        ...BASE_CREATE_ARGS.slice(0, 3),
        'customer db',
        ...BASE_CREATE_ARGS.slice(4)
      ],
      stderr:
        'Error: Name must match ^[a-zA-Z0-9-_]{1,128}$.\n\nNext step: Pass a name with letters, numbers, hyphens, or underscores using --name.\n'
    },
    {
      args: [
        ...BASE_CREATE_ARGS.slice(0, 11),
        'a'.repeat(65),
        ...BASE_CREATE_ARGS.slice(12)
      ],
      stderr:
        'Error: Database name must be 64 characters or fewer.\n\nNext step: Retry with a shorter value for --database-name.\n'
    },
    {
      args: [...BASE_CREATE_ARGS, '--username', 'Admin'],
      stderr:
        'Error: Username must contain only lowercase letters and digits, up to 80 characters.\n\nNext step: Retry with --username set to a lowercase alphanumeric value such as admin.\n'
    },
    {
      args: BASE_CREATE_ARGS.slice(0, -2),
      stderr:
        'Error: Password is required.\n\nNext step: Pass --password for interactive use, or --password-file with a file path or - for stdin.\n'
    },
    {
      args: [...BASE_CREATE_ARGS, '--password-file', '/tmp/also-a-password'],
      stderr:
        'Error: Use only one password source.\n\nNext step: Remove one password source. Prefer --password-file for scripts and secret managers.\n'
    },
    {
      args: [
        ...BASE_CREATE_ARGS.slice(0, 9),
        ' ',
        ...BASE_CREATE_ARGS.slice(10)
      ],
      stderr:
        'Error: Plan cannot be empty.\n\nNext step: Pass a non-empty value with --plan.\n'
    }
  ])(
    'rejects invalid create options before API access',
    async ({ args, stderr }) => {
      const result = await runBuiltCli(args);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(stderr);
    }
  );

  it.each([
    {
      args: ['dbaas', 'get', 'not-a-number'],
      stderr:
        'Error: DBaaS ID must be numeric.\n\nNext step: Pass the numeric dbaas id as the first argument.\n'
    },
    {
      args: ['dbaas', 'network', 'attach-vpc', '7869', '--vpc-id', ' '],
      stderr:
        'Error: VPC ID cannot be empty.\n\nNext step: Pass the numeric vpc id as --vpc-id.\n'
    },
    {
      args: ['dbaas', 'whitelist', 'add', '7869', '--ip', '999.1.1.1'],
      stderr:
        'Error: IP address must be a valid IPv4 address or CIDR.\n\nNext step: Pass an IPv4 address such as 203.0.113.10, or a CIDR such as 203.0.113.0/24.\n'
    },
    {
      args: ['dbaas', 'network', 'detach-public-ip', '7869'],
      stderr:
        'Error: Detaching a DBaaS public IP requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force only if you accept that external DBaaS connectivity will be lost.\n'
    }
  ])(
    'rejects invalid network and identifier inputs',
    async ({ args, stderr }) => {
      const result = await runBuiltCli(args);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(stderr);
    }
  );

  it('fails clearly when a password file cannot be read before API access', async () => {
    const missingPasswordFile = '/tmp/e2ectl-missing-dbaas-password.txt';
    const result = await runBuiltCli([
      ...BASE_CREATE_ARGS.slice(0, -2),
      '--password-file',
      missingPasswordFile
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      `Error: Could not read DBaaS password file: ${missingPasswordFile}\n\nNext step: Verify that the file exists, is readable, and contains only the DBaaS admin password.\n`
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
