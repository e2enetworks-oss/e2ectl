import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

const REQUIRED_CREATE_ARGS = [
  '--department',
  '101',
  '--subject',
  'subj',
  '--description',
  'desc',
  '--ticket-category',
  'Cloud',
  '--component',
  'Auto Scaling',
  '--priority',
  'High'
];

describe('support-ticket input validation errors', () => {
  it('rejects an invalid --status value on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--status', 'Bogus'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--status');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --category value on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--category', 'Bogus'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--category');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --priority value on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--priority', 'Critical'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--priority');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an all-empty repeatable list value', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--category', ' , , '],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--category');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --contact-email on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--contact-email', 'not-an-email'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--contact-email');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --contact-type on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--contact-type', 'Unknown'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--contact-type');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --per-page on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--per-page', '-3'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--per-page');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --year on list', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--year', 'abc'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--year');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a non-numeric ticket id on get', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'get', 'abc'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('ticketId');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a non-numeric ticket id on get-replies', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'get-replies', '0'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('ticketId');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a non-numeric ticket id on reply', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'reply', 'abc', '--comment', 'hi'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('ticketId');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a non-numeric ticket id on close', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'close', 'abc', '--comment', 'done'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('ticketId');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a --subject longer than 256 characters', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const longSubject = 'a'.repeat(300);
      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          '--department',
          '101',
          '--subject',
          longSubject,
          '--description',
          'desc',
          '--ticket-category',
          'Cloud',
          '--component',
          'Auto Scaling',
          '--priority',
          'High'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--subject');
      expect(result.stderr).toContain('256');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --priority on create', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          '--department',
          '101',
          '--subject',
          'subj',
          '--description',
          'desc',
          '--ticket-category',
          'Cloud',
          '--component',
          'Auto Scaling',
          '--priority',
          'Critical'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--priority');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --contact-email on create', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--contact-email',
          'not-an-email'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--contact-email');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an invalid --cc email on create', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--cc',
          'bad-email'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--cc');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('treats whitespace-only --cc values as if --cc was omitted', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/tickets/': () => ({
        body: {
          code: 200,
          data: {
            channel: 'Web',
            created_at: '2026-05-19 09:00:00',
            id: 42,
            is_priority_ticket: false,
            priority: 'High',
            status: 'Open',
            subject: 'subj',
            ticket_category: 'Cloud',
            ticket_number: 'T-100042',
            updated_at: '2026-05-19 09:00:00'
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
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--cc',
          '   ',
          '--cc',
          '\t'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[0]?.body ?? '{}') as {
        cc_email_list: string[];
      };
      expect(body.cc_email_list).toEqual([]);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects --component when omitted for a Cloud ticket', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          '--department',
          '101',
          '--subject',
          'subj',
          '--description',
          'desc',
          '--ticket-category',
          'Cloud',
          '--priority',
          'High'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--component');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects --resource when the category is not Cloud', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          '--department',
          '101',
          '--subject',
          'subj',
          '--description',
          'desc',
          '--ticket-category',
          'Network',
          '--resource',
          '1:node-a'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--resource');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a malformed --resource value (wrong segment count)', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--resource',
          'only-one-segment'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--resource');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects a --resource value with empty id or name segments', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--resource',
          ':node-a'
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--resource');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an empty --resource value', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--resource',
          '   '
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--resource');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects more than 5 --attachment flags', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const paths: string[] = [];
      for (let i = 0; i < 6; i++) {
        paths.push(
          await tempHome.writeImportFile(`attachments/file-${i}.pdf`, 'x')
        );
      }

      const attachmentArgs = paths.flatMap((p) => ['--attachment', p]);
      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          ...attachmentArgs
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--attachment');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an empty --attachment path', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--attachment',
          '   '
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--attachment');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an --attachment path that cannot be read', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--attachment',
          `${tempHome.path}/does-not-exist.pdf`
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('attachment');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an --attachment file larger than 5 MB', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const bigPath = await tempHome.writeImportFile(
        'attachments/big.pdf',
        'x'.repeat(5 * 1024 * 1024 + 10)
      );

      const result = await runBuiltCli(
        [
          'support-ticket',
          'create',
          ...REQUIRED_CREATE_ARGS,
          '--attachment',
          bigPath
        ],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('5 MB');
    } finally {
      await tempHome.cleanup();
    }
  });
});
