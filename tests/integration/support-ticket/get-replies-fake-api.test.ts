import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('support-ticket get/replies against a fake MyAccount API', () => {
  it('fetches a ticket detail, normalizes HTML description, and forwards contact filters', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket/42/': () => ({
        body: {
          account_manager: 'Asha Iyer',
          code: 200,
          data: {
            channel: 'Web',
            created_at: '2026-05-18 14:32:15',
            crn: 'CRN-1',
            customer_type: 'Standard',
            department: 'Cloud Support',
            description: '<div>Line 1<br>Line 2</div>',
            emails_cc_on_ticket: ['cc@example.com'],
            id: 42,
            is_priority_ticket: false,
            priority: 'High',
            reply_option: true,
            status: 'Open',
            subject: 'Cannot reach my VM',
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

      const result = await runBuiltCli(
        [
          '--json',
          'support-ticket',
          'get',
          '42',
          '--contact-email',
          'me@example.com',
          '--contact-type',
          'Admin'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      const parsed = JSON.parse(result.stdout) as {
        account_manager: string;
        action: string;
        ticket: {
          customer_type: string;
          description: string;
          id: number;
        };
      };

      expect(parsed.action).toBe('get');
      expect(parsed.account_manager).toBe('Asha Iyer');
      expect(parsed.ticket.id).toBe(42);
      expect(parsed.ticket.customer_type).toBe('Standard');
      expect(parsed.ticket.description).toBe('Line 1\nLine 2');

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.query).toMatchObject({
        contact_person_email: 'me@example.com',
        contact_person_type: 'Admin'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders the get output as a human-readable table including the account manager', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket/42/': () => ({
        body: {
          account_manager: 'Asha Iyer',
          code: 200,
          data: {
            channel: 'Web',
            created_at: '2026-05-18 14:32:15',
            department: 'Cloud Support',
            description: 'VM is unreachable.',
            emails_cc_on_ticket: [],
            id: 42,
            is_priority_ticket: false,
            priority: 'High',
            reply_option: false,
            status: 'Open',
            subject: 'Cannot reach my VM',
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
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('T-100042');
      expect(result.stdout).toContain('Cannot reach my VM');
      expect(result.stdout).toContain('Account Manager');
      expect(result.stdout).toContain('Asha Iyer');
      expect(result.stdout).toContain('Reply Allowed');
      expect(result.stdout).toContain('no');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails locally when get receives a non-numeric ticket id', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'get', 'abc'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('positive integer');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('lists replies, normalizes attachments, and expands truncated thread summaries', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-conservation/466/':
        () => ({
          body: {
            code: 200,
            data: [
              {
                attachment_list: {
                  data: [
                    {
                      attachment_index: 0,
                      download_url: 'https://example.com/foo.png',
                      file_name: 'foo.png'
                    }
                  ]
                },
                author: {
                  email: 'engineer@example.com',
                  name: 'Engineer'
                },
                canReply: true,
                channel: 'EMAIL',
                contentType: 'text/html',
                createdTime: '2026-05-13T16:09:19.307Z',
                direction: 'out',
                id: 'thread-1',
                isDescriptionThread: false,
                summary: 'Hello',
                to: 'customer@example.com',
                visibility: 'public'
              },
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
          body: {
            code: 200,
            data: {
              content:
                '<p>Long reply truncated&nbsp;but here is the full text.</p>',
              id: 'thread-2'
            },
            errors: {},
            message: 'Success'
          }
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'support-ticket', 'replies', '466'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      const parsed = JSON.parse(result.stdout) as {
        action: string;
        threads: Array<{
          attachments: Array<{ file_name: string }>;
          id: string;
          summary: string;
        }>;
        ticket_id: number;
      };

      expect(parsed.action).toBe('replies');
      expect(parsed.ticket_id).toBe(466);
      expect(parsed.threads).toHaveLength(2);
      expect(parsed.threads[0]?.id).toBe('thread-1');
      expect(parsed.threads[0]?.attachments).toEqual([
        { download_url: 'https://example.com/foo.png', file_name: 'foo.png' }
      ]);
      expect(parsed.threads[1]?.summary).toBe(
        'Long reply truncated but here is the full text.'
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[1]?.pathname).toBe(
        '/myaccount/api/v1/ticket_management/ticket-thread-conservation/466/thread-2/'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders an empty replies state in human mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-conservation/466/':
        () => ({
          body: {
            code: 200,
            data: [],
            errors: {},
            message: 'Success'
          }
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'replies', '466'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('No replies on support ticket 466.\n');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders the replies table in human mode with author labels and attachment names', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-conservation/466/':
        () => ({
          body: {
            code: 200,
            data: [
              {
                attachment_list: {
                  data: [{ download_url: 'https://x/y', file_name: 'log.txt' }]
                },
                author: { email: 'engineer@example.com', name: 'Engineer' },
                canReply: true,
                createdTime: '2026-05-13T16:09:19.307Z',
                direction: 'out',
                id: 'thread-1',
                isDescriptionThread: false,
                summary: 'Hello there',
                visibility: 'public'
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

      const result = await runBuiltCli(['support-ticket', 'replies', '466'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Replies on support ticket 466');
      expect(result.stdout).toContain('Engineer <engineer@example.com>');
      expect(result.stdout).toContain('Hello there');
      expect(result.stdout).toContain('log.txt');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
