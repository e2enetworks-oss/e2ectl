import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

const TIMELINE_DATA = [
  {
    actor: 'Asha Iyer',
    description: 'Ticket created',
    status: 'Open',
    time: '2026-05-18 14:32:15',
    type: 'created'
  },
  {
    event: 'comment_added',
    event_time: '2026-05-19 10:00:00',
    performed_by: 'Customer',
    summary: 'Added a comment'
  }
];

describe('support-ticket timeline against a fake MyAccount API', () => {
  it('fetches the timeline without filters and normalizes the events as JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-timeline/466/': () => ({
        body: {
          code: 200,
          data: TIMELINE_DATA,
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'support-ticket', 'timeline', '466'],
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
        events: Array<{
          actor: string | null;
          description: string | null;
          event_type: string | null;
        }>;
        filters: { month: number | null; year: number | null };
        ticket_id: number;
      };

      expect(parsed.action).toBe('timeline');
      expect(parsed.ticket_id).toBe(466);
      expect(parsed.filters).toEqual({ month: null, year: null });
      expect(parsed.events).toEqual([
        {
          actor: 'Asha Iyer',
          description: 'Ticket created',
          event_type: 'created',
          status: 'Open',
          time: '2026-05-18 14:32:15'
        },
        {
          actor: 'Customer',
          description: 'Added a comment',
          event_type: 'comment_added',
          status: null,
          time: '2026-05-19 10:00:00'
        }
      ]);

      expect(server.requests).toHaveLength(1);
      // No month/year filters were passed, so they must not appear on the query.
      expect(server.requests[0]?.query).not.toHaveProperty('month');
      expect(server.requests[0]?.query).not.toHaveProperty('year');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('forwards --month and --year as query params and renders a human-readable table', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-timeline/466/': () => ({
        body: {
          code: 200,
          data: [TIMELINE_DATA[0]],
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
          'timeline',
          '466',
          '--month',
          '05',
          '--year',
          '2026'
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
      expect(result.stdout).toContain('Timeline for support ticket 466');
      expect(result.stdout).toContain('Asha Iyer');
      expect(result.stdout).toContain('Ticket created');

      expect(server.requests[0]?.query).toMatchObject({
        month: '5',
        year: '2026'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders an empty timeline state in human mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-timeline/466/': () => ({
        body: { code: 200, data: [], errors: {}, message: 'Success' }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'timeline', '466'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('No timeline events on support ticket 466.\n');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects an out-of-range --month before hitting the API', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['support-ticket', 'timeline', '466', '--month', '13'],
        { env: { HOME: tempHome.path } }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--month');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('surfaces a non-zero exit when the timeline API call fails', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ticket_management/ticket-timeline/466/': () => ({
        body: { code: 500, data: null, errors: {}, message: 'boom' },
        status: 500
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['support-ticket', 'timeline', '466'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
