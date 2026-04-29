import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function mysqlClusterBody() {
  return {
    created_at: '2026-04-24T12:00:00.000Z',
    id: 7869,
    master_node: {
      cluster_id: 7869,
      database: {
        database: 'appdb',
        id: 11,
        pg_detail: {},
        username: 'admin'
      },
      domain: 'db.example.com',
      port: '3306',
      public_ip_address: '1.2.3.4',
      public_port: 3306
    },
    name: 'customer-db',
    software: {
      engine: 'Relational',
      id: 301,
      name: 'MySQL',
      version: '8.0'
    },
    status: 'Running',
    status_title: 'Running'
  };
}

describe('dbaas delete and reset-password against a fake MyAccount API', () => {
  it('resets passwords through the cluster reset-password path', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/7869/': () => ({
        body: {
          code: 200,
          data: mysqlClusterBody(),
          errors: {},
          message: 'OK'
        }
      }),
      'PUT /myaccount/api/v1/rds/cluster/7869/reset-password/': () => ({
        body: {
          code: 200,
          data: {
            cluster_id: 7869,
            name: 'customer-db'
          },
          errors: {},
          message:
            'Password reset request processed successfully. Please wait 30-40 seconds for the update to propagate.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'dbaas',
          'reset-password',
          '7869',
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

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'reset-password',
          dbaas: {
            connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            type: 'MySQL',
            username: 'admin',
            version: '8.0'
          },
          message:
            'Password reset request processed successfully. Please wait 30-40 seconds for the update to propagate.'
        })}\n`
      );
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        password: 'ValidPassword1!A',
        username: 'admin'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('resets passwords from stdin when --password-file - is used', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/7869/': () => ({
        body: {
          code: 200,
          data: mysqlClusterBody(),
          errors: {},
          message: 'OK'
        }
      }),
      'PUT /myaccount/api/v1/rds/cluster/7869/reset-password/': () => ({
        body: {
          code: 200,
          data: {
            cluster_id: 7869,
            name: 'customer-db'
          },
          errors: {},
          message: 'Password reset request processed successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['dbaas', 'reset-password', '7869', '--password-file', '-'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          },
          stdin: 'ValidPassword1!A\n'
        }
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        password: 'ValidPassword1!A',
        username: 'admin'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes supported DBaaS clusters with --force', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/rds/cluster/7869/': () => ({
        body: {
          code: 200,
          data: mysqlClusterBody(),
          errors: {},
          message: 'OK'
        }
      }),
      'DELETE /myaccount/api/v1/rds/cluster/7869/': () => ({
        body: {
          code: 200,
          data: {
            cluster_id: 7869,
            name: 'customer-db'
          },
          errors: {},
          message: 'Deleted'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'dbaas', 'delete', '7869', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'delete',
          cancelled: false,
          dbaas: {
            connection_string: 'mysql -h db.example.com -P 3306 -u admin -p',
            database_name: 'appdb',
            id: 7869,
            name: 'customer-db',
            type: 'MySQL',
            username: 'admin',
            version: '8.0'
          },
          dbaas_id: 7869,
          message: 'Deleted customer-db.'
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
