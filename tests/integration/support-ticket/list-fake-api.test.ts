import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('support-ticket list against a fake MyAccount API', () => {
  it('lists tickets and emits deterministic JSON with sorted, normalized items', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/tickets/filter/': () => ({
        body: {
          'X-Open-Count': 7,
          'X-Resolved-Count': 50,
          'X-Urgent-Count': 2,
          account_manager: 'Asha Iyer',
          code: 200,
          data: [
            {
              channel: 'Web',
              created_at: '2026-05-18 14:32:15',
              description: '<p>VM is unreachable.</p>',
              emails_cc_on_ticket: ['cc1@example.com', 'cc2@example.com', ''],
              id: 41,
              is_priority_ticket: false,
              priority: 'Medium',
              status: 'Open',
              subject: 'Older ticket',
              ticket_category: 'Cloud',
              ticket_number: 'T-100041',
              updated_at: '2026-05-18 14:32:15'
            },
            {
              channel: 'Web',
              created_at: '2026-05-19 09:00:00',
              description: 'Just text',
              emails_cc_on_ticket: [],
              id: 42,
              is_priority_ticket: true,
              priority: 'High',
              status: 'Open',
              subject: 'Cannot reach my VM',
              ticket_category: 'Cloud',
              ticket_number: 'T-100042',
              updated_at: '2026-05-19 09:00:00'
            }
          ],
          errors: {},
          message: 'Success',
          page_no: 1,
          per_page: 25,
          total_pages: 3,
          total_records: 57
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'support-ticket', 'list', '--page-no', '1', '--per-page', '25'],
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
        items: Array<{
          description: string | null;
          emails_cc_on_ticket: string[];
          id: number;
        }>;
        page: { open_count: number; total_records: number };
      };

      expect(parsed.action).toBe('list');
      expect(parsed.account_manager).toBe('Asha Iyer');
      expect(parsed.items.map((item) => item.id)).toEqual([42, 41]);
      expect(parsed.items[1]?.description).toBe('VM is unreachable.');
      expect(parsed.items[1]?.emails_cc_on_ticket).toEqual([
        'cc1@example.com',
        'cc2@example.com'
      ]);
      expect(parsed.page).toMatchObject({
        open_count: 7,
        total_records: 57
      });

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/ticket_management/tickets/filter/',
        query: {
          page_no: '1',
          per_page: '25'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('translates SOC/Abuse categories into boolean filters on the query string', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/tickets/filter/': () => ({
        body: {
          account_manager: null,
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

      const result = await runBuiltCli(
        [
          'support-ticket',
          'list',
          '--category',
          'Cloud,SOC,Abuse',
          '--status',
          'open',
          '--priority',
          'urgent'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('No support tickets found.\n');
      expect(server.requests[0]?.query).toMatchObject({
        abuse_ticket: 'true',
        priority: 'High,Medium',
        soc_ticket: 'true',
        status: 'Open,On Hold,Waiting on Customer,Escalated',
        ticket_category: 'Cloud'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders a human-readable table with paging and counts footer', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/tickets/filter/': () => ({
        body: {
          'X-Open-Count': 1,
          'X-Resolved-Count': 0,
          'X-Urgent-Count': 1,
          account_manager: 'Asha Iyer',
          code: 200,
          data: [
            {
              channel: 'Web',
              created_at: '2026-05-19 09:00:00',
              description: 'desc',
              emails_cc_on_ticket: [],
              id: 42,
              is_priority_ticket: true,
              priority: 'High',
              status: 'Open',
              subject: 'Cannot reach my VM',
              ticket_category: 'Cloud',
              ticket_number: 'T-100042',
              updated_at: '2026-05-19 09:00:00'
            }
          ],
          errors: {},
          message: 'Success',
          page_no: 1,
          total_pages: 1,
          total_records: 1
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
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('T-100042');
      expect(result.stdout).toContain('Cannot reach my VM');
      expect(result.stdout).toContain('Page 1 of 1');
      expect(result.stdout).toContain('1 total');
      expect(result.stdout).toContain('Open: 1');
      expect(result.stdout).toContain('Urgent: 1');
      expect(result.stdout).toContain('Resolved: 0');
      expect(result.stdout).toContain('Account Manager: Asha Iyer');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('exits with a usage error when --page-no is not a positive integer', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'list', '--page-no', '0'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--page-no');
    } finally {
      await tempHome.cleanup();
    }
  });
});
