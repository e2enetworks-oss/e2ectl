import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('support-ticket reopen against a fake MyAccount API', () => {
  it('reopens a ticket and surfaces the API message in JSON output', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-comment-reopen/466/':
        () => ({
          body: {
            code: 200,
            data: { message: 'Ticket reopened.' },
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
          '--json',
          'support-ticket',
          'reopen',
          '466',
          '--comment',
          '  issue recurred  '
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
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'reopen',
          message: 'Ticket reopened.',
          ticket_id: 466
        })}\n`
      );

      const body = JSON.parse(server.requests[0]?.body ?? '{}') as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({ comment: 'issue recurred' });
      expect(body).not.toHaveProperty('contact_person_email');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('emits a human-readable reopen confirmation and forwards contact filters', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-comment-reopen/466/':
        () => ({
          body: {
            code: 200,
            data: null,
            errors: {},
            message: 'Ticket reopened.'
          }
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'reopen',
          '466',
          '--comment',
          'please reopen',
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
      expect(result.stdout).toContain('Reopened support ticket 466');
      expect(result.stdout).toContain('Ticket reopened.');

      const body = JSON.parse(server.requests[0]?.body ?? '{}') as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({
        comment: 'please reopen',
        contact_person_email: 'me@example.com',
        contact_person_type: 'Admin'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects a non-numeric ticket id on reopen before hitting the API', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'reopen', 'abc', '--comment', 'again'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('ticketId');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an empty --comment on reopen before hitting the API', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'reopen', '466', '--comment', '   '],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--comment');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('surfaces a non-zero exit when the reopen API call fails', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-comment-reopen/466/':
        () => ({
          body: { code: 500, data: null, errors: {}, message: 'boom' },
          status: 500
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'reopen', '466', '--comment', 'again'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
