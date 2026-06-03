import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('support-ticket behavior edge cases', () => {
  it('prints help when invoked without a subcommand', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage MyAccount support tickets');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('create');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('emits a JSON envelope when closing a ticket', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-comment-close/466/':
        () => ({
          body: {
            code: 200,
            data: { message: 'Ticket closed successfully.' },
            errors: {},
            message: 'OK'
          }
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'support-ticket', 'close', '466', '--comment', 'thanks'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        action: string;
        message: string;
        ticket_id: number;
      };
      expect(parsed.action).toBe('close');
      expect(parsed.message).toBe('Ticket closed successfully.');
      expect(parsed.ticket_id).toBe(466);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders -- for Reply Allowed when the API returns a non-boolean reply_option', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket/42/': () => ({
        body: {
          account_manager: null,
          code: 200,
          data: {
            channel: 'Web',
            created_at: '2026-05-18 14:32:15',
            department: 'Cloud Support',
            description: 'desc',
            emails_cc_on_ticket: [],
            id: 42,
            is_priority_ticket: false,
            priority: 'High',
            reply_option: null,
            status: 'Open',
            subject: 'subj',
            ticket_category: 'Cloud',
            ticket_number: 'T-100042',
            updated_at: '2026-05-18 14:32:15'
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'get', '42'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Reply Allowed');
      expect(result.stdout).toContain('--');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('truncates long subjects in the list table', async () => {
    const longSubject = 'a'.repeat(80);
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/tickets/filter/': () => ({
        body: {
          account_manager: null,
          code: 200,
          data: [
            {
              channel: 'Web',
              created_at: '2026-05-19 09:00:00',
              description: 'desc',
              emails_cc_on_ticket: [],
              id: 42,
              is_priority_ticket: false,
              priority: 'High',
              status: 'Open',
              subject: longSubject,
              ticket_category: 'Cloud',
              ticket_number: 'T-100042',
              updated_at: '2026-05-19 09:00:00'
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('…');
      expect(result.stdout).not.toContain(longSubject);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('falls back to the original summary when the thread detail request fails', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-conservation/466/':
        () => ({
          body: {
            code: 200,
            data: [
              {
                author: { email: 'cust@example.com', name: 'Customer' },
                createdTime: '2026-05-14T10:00:00.000Z',
                direction: 'in',
                id: 'thread-2',
                isDescriptionThread: false,
                summary: 'Long reply truncated...',
                visibility: 'public'
              }
            ],
            errors: {},
            message: 'Success'
          }
        }),
      'GET /myaccount/api/v1/ticket_management/ticket-thread-conservation/466/thread-2/':
        () => ({
          body: { code: 500, data: null, errors: {}, message: 'Server error' },
          status: 500
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'support-ticket', 'get-replies', '466'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        threads: Array<{ summary: string }>;
      };
      expect(parsed.threads[0]?.summary).toBe('Long reply truncated...');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
