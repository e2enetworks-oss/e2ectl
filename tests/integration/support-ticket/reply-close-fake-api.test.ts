import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('support-ticket reply/close against a fake MyAccount API', () => {
  it('replies on a ticket and surfaces the API message in JSON output', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-reply/42/': () => ({
        body: {
          code: 200,
          data: { message: 'Reply posted.' },
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
          'reply',
          '42',
          '--comment',
          '  Any update?  '
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
          action: 'reply',
          message: 'Reply posted.',
          ticket_id: 42
        })}\n`
      );

      const body = JSON.parse(server.requests[0]?.body ?? '{}') as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({
        abuse_ticket: false,
        comment: 'Any update?',
        contact_person_email: '',
        contact_person_type: ''
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('reply forwards --abuse-ticket as a query param and includes the file attachment payload', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-reply/466/': () => ({
        body: {
          code: 200,
          data: { message: 'Reply posted.' },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const attachmentPath = await tempHome.writeImportFile(
        'attachments/photo.jpg',
        'jpegdata'
      );

      const result = await runBuiltCli(
        [
          'support-ticket',
          'reply',
          '466',
          '--comment',
          'see attached',
          '--abuse-ticket',
          '--attachment',
          attachmentPath
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
      expect(result.stdout).toContain('Replied to support ticket 466');
      expect(result.stdout).toContain('Reply posted.');

      expect(server.requests[0]?.query).toMatchObject({ abuse_ticket: 'true' });
      const body = JSON.parse(server.requests[0]?.body ?? '{}') as {
        abuse_ticket: boolean;
        file?: string;
        file_name: string[];
        imagedata: string[];
      };
      expect(body.abuse_ticket).toBe(false);
      expect(body.file).toBeUndefined();
      expect(body.file_name).toEqual(['photo.jpg']);
      expect(body.imagedata[0]).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('closes a ticket and emits the human-readable close confirmation', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/ticket-comment-close/466/':
        () => ({
          body: {
            code: 200,
            data: null,
            errors: {},
            message: 'Ticket closed.'
          }
        })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'close', '466', '--comment', '  thanks  '],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Closed support ticket 466');
      expect(result.stdout).toContain('Ticket closed.');

      const body = JSON.parse(server.requests[0]?.body ?? '{}') as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({ comment: 'thanks' });
      expect(body).not.toHaveProperty('contact_person_email');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects an empty --comment on close before hitting the API', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'close', '466', '--comment', '   '],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--comment');
    } finally {
      await tempHome.cleanup();
    }
  });
});
