import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

// The real create endpoint returns only the identifiers; the CLI then fetches
// the full detail via GET ticket/<id>/.
const CREATE_RESPONSE = {
  id: 42,
  ticket_id: 'ZD-123',
  ticket_number: 'T-100042'
};

const SUCCESS_TICKET = {
  channel: 'Web',
  created_at: '2026-05-19 09:00:00',
  department: 'Cloud Support',
  description: 'VM is unreachable.',
  emails_cc_on_ticket: [],
  id: 42,
  is_priority_ticket: false,
  priority: 'High',
  status: 'Open',
  subject: 'Cannot reach my VM',
  ticket_category: 'Cloud',
  ticket_id: 'ZD-123',
  ticket_number: 'T-100042',
  updated_at: '2026-05-19 09:00:00'
};

const CREATE_HANDLERS = {
  'POST /myaccount/api/v1/ticket_management/tickets/': () => ({
    body: {
      code: 200,
      data: CREATE_RESPONSE,
      errors: {},
      message: 'OK'
    }
  }),
  'GET /myaccount/api/v1/ticket_management/ticket/42/': () => ({
    body: {
      account_manager: 'Asha Iyer',
      code: 200,
      data: SUCCESS_TICKET,
      errors: {},
      message: 'OK'
    }
  })
};

describe('support-ticket create against a fake MyAccount API', () => {
  it('posts a normalized Cloud ticket payload and renders the create result as JSON', async () => {
    const server = await startTestHttpServer(CREATE_HANDLERS);
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'support-ticket',
          'create',
          '--department',
          '101',
          '--subject',
          '  Cannot reach my VM ',
          '--description',
          'VM is unreachable.',
          '--ticket-category',
          'cloud',
          '--component',
          'Auto Scaling',
          '--priority',
          'High',
          '--resource',
          '2464:node-a:10.0.0.1',
          '--cc',
          'a@example.com',
          '--cc',
          'b@example.com'
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
        action: string;
        ticket: { id: number; ticket_number: string };
      };
      expect(parsed.action).toBe('create');
      expect(parsed.ticket.id).toBe(42);

      // POST to create, then GET to load the full detail (Option A).
      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]?.method).toBe('POST');
      expect(server.requests[1]?.method).toBe('GET');
      const body = JSON.parse(server.requests[0]?.body ?? '{}') as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({
        cc_email_list: ['a@example.com', 'b@example.com'],
        channel: 'Web',
        component: 'Auto Scaling',
        contact_person_email: '',
        contact_person_type: '',
        department: 101,
        description: 'VM is unreachable.',
        file_name: [],
        imagedata: [],
        priority: 'High',
        resource: [{ id: '2464', ip_address: '10.0.0.1', name: 'node-a' }],
        subject: 'Cannot reach my VM',
        ticket_category: 'Cloud'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('reads --attachment files from disk and base64-encodes them', async () => {
    const server = await startTestHttpServer(CREATE_HANDLERS);
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const attachmentPath = await tempHome.writeImportFile(
        'attachments/report.pdf',
        'hello'
      );

      const result = await runBuiltCli(
        [
          '--json',
          'support-ticket',
          'create',
          '--department',
          '2',
          '--subject',
          'Invoice',
          '--description',
          'Need invoice',
          '--ticket-category',
          'Billing',
          '--component',
          'Account Statement',
          '--priority',
          'Medium',
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

      const body = JSON.parse(server.requests[0]?.body ?? '{}') as {
        file_name: string[];
        imagedata: string[];
      };
      expect(body.file_name).toEqual(['report.pdf']);
      // writeImportFile appends a trailing newline → "hello\n" => base64 aGVsbG8K
      expect(body.imagedata[0]).toMatch(/^data:application\/pdf;base64,/);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders a human-readable create result with a next-step hint', async () => {
    const server = await startTestHttpServer(CREATE_HANDLERS);
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
          'Cannot reach my VM',
          '--description',
          'VM is unreachable.',
          '--ticket-category',
          'Cloud',
          '--component',
          'Auto Scaling',
          '--priority',
          'High'
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
      expect(result.stdout).toContain('Created support ticket T-100042');
      expect(result.stdout).toContain('support-ticket get 42');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('still succeeds with a stderr warning when the post-create detail fetch fails', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ticket_management/tickets/': () => ({
        body: {
          code: 200,
          data: CREATE_RESPONSE,
          errors: {},
          message: 'OK'
        }
      }),
      'GET /myaccount/api/v1/ticket_management/ticket/42/': () => ({
        body: { code: 500, data: null, errors: {}, message: 'boom' },
        status: 500
      })
    });
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
          'Cannot reach my VM',
          '--description',
          'VM is unreachable.',
          '--ticket-category',
          'Cloud',
          '--component',
          'Auto Scaling',
          '--priority',
          'High'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      // The ticket was created, so the command succeeds — but the truncated
      // detail is flagged on stderr, never silently presented as the ticket.
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created support ticket T-100042');
      expect(result.stdout).toContain('ID: 42');
      expect(result.stderr).toContain('Warning:');
      expect(result.stderr).toContain('support-ticket get 42');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects a Cloud ticket without --priority before hitting the API', async () => {
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
          'Auto Scaling'
        ],
        {
          env: { HOME: tempHome.path }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--priority');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('rejects an unsupported attachment extension', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const badPath = await tempHome.writeImportFile(
        'attachments/notes.txt',
        'bad'
      );

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
          'High',
          '--attachment',
          badPath
        ],
        {
          env: { HOME: tempHome.path }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('.jpg');
    } finally {
      await tempHome.cleanup();
    }
  });
});
