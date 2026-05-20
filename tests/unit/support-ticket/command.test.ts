import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import { stableStringify } from '../../../src/core/json.js';
import type { SupportTicketClient } from '../../../src/support-ticket/index.js';
import type { SupportTicketDetail } from '../../../src/support-ticket/types/index.js';
import type { LoadBalancerClient } from '../../../src/load-balancer/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { SslClient } from '../../../src/ssl/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function sampleTicket(): SupportTicketDetail {
  return {
    created_at: '2026-05-18 14:32:15',
    department: 'Cloud Support',
    department_id: '101',
    description: 'VM is unreachable.',
    id: 42,
    is_priority_ticket: false,
    priority: 'High',
    status: 'Open',
    subject: 'Cannot reach my VM',
    ticket_category: 'Cloud',
    ticket_id: 'ZD-123',
    ticket_number: 'T-100042',
    updated_at: '2026-05-18 14:32:15'
  };
}

function createSupportTicketStub(): {
  closeTicket: ReturnType<typeof vi.fn>;
  createTicket: ReturnType<typeof vi.fn>;
  getThread: ReturnType<typeof vi.fn>;
  getTicket: ReturnType<typeof vi.fn>;
  listReplies: ReturnType<typeof vi.fn>;
  listTickets: ReturnType<typeof vi.fn>;
  replyTicket: ReturnType<typeof vi.fn>;
  stub: SupportTicketClient;
} {
  const createTicket = vi.fn(() => Promise.resolve(sampleTicket()));
  const getTicket = vi.fn(() =>
    Promise.resolve({
      account_manager: 'Asha Iyer',
      ticket: sampleTicket()
    })
  );
  const listTickets = vi.fn(() =>
    Promise.resolve({
      account_manager: null,
      items: [sampleTicket()],
      open_count: 1,
      page_no: 1,
      per_page: 25,
      resolved_count: 0,
      total_pages: 1,
      total_records: 1,
      urgent_count: 0
    })
  );
  const replyTicket = vi.fn(() =>
    Promise.resolve({ message: 'Reply posted.' })
  );
  const closeTicket = vi.fn(() =>
    Promise.resolve({ message: 'Ticket closed.' })
  );
  const listReplies = vi.fn(() => Promise.resolve([]));
  const getThread = vi.fn();

  return {
    closeTicket,
    createTicket,
    getThread,
    getTicket,
    listReplies,
    listTickets,
    replyTicket,
    stub: {
      closeTicket,
      createTicket,
      getThread,
      getTicket,
      listReplies,
      listTickets,
      replyTicket
    }
  };
}

describe('support-ticket commands', () => {
  function createRuntimeFixture(): {
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    supportTicketStub: ReturnType<typeof createSupportTicketStub>;
  } {
    const configPath = createTestConfigPath('support-ticket-test');
    const store = new ConfigStore({ configPath });
    const stderr = new MemoryWriter();
    const stdout = new MemoryWriter();
    const supportTicketStub = createSupportTicketStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createImageClient: vi.fn(() => {
        throw new Error('Image client should not be created for this test.');
      }) as unknown as CliRuntime['createImageClient'],
      createDbaasClient: vi.fn(() => {
        throw new Error('DBaaS client should not be created for this test.');
      }) as unknown as CliRuntime['createDbaasClient'],
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as CliRuntime['createNodeClient'],
      createProjectClient: vi.fn(() => {
        throw new Error('Project client should not be created for this test.');
      }) as unknown as CliRuntime['createProjectClient'],
      createReservedIpClient: vi.fn(() => {
        throw new Error(
          'Reserved IP client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createReservedIpClient'],
      createSecurityGroupClient: vi.fn(() => {
        throw new Error(
          'Security group client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createSecurityGroupClient'],
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SshKeyClient,
      createSslClient: vi.fn(() => {
        throw new Error('SSL client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SslClient,
      createSupportTicketClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return supportTicketStub.stub;
      },
      createLoadBalancerClient: vi.fn(() => {
        throw new Error(
          'Load balancer client should not be created for this test.'
        );
      }) as unknown as (credentials: ResolvedCredentials) => LoadBalancerClient,
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as CliRuntime['createVolumeClient'],
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as CliRuntime['createVpcClient'],
      credentialValidator: { validate: vi.fn() },
      isInteractive: true,
      prompt: vi.fn(() => Promise.resolve('')),
      stderr,
      stdout,
      store
    };

    return {
      receivedCredentials: () => credentials,
      runtime,
      stdout,
      supportTicketStub
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_location: 'Delhi',
      default_project_id: '12345'
    });
  }

  it('lists tickets in deterministic JSON mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'support-ticket',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '12345'
    });
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      items: Array<{ id: number }>;
    };
    expect(parsed.action).toBe('list');
    expect(parsed.items.map((item) => item.id)).toEqual([42]);
  });

  it('translates list filter flags (category presets, status/priority shortcuts, year)', async () => {
    const { runtime, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'support-ticket',
      'list',
      '--alias',
      'prod',
      '--category',
      'Cloud,SOC,Abuse',
      '--status',
      'open',
      '--priority',
      'urgent',
      '--year',
      '2026'
    ]);

    expect(supportTicketStub.listTickets).toHaveBeenCalledWith({
      abuseTicket: true,
      category: 'Cloud',
      priority: 'High,Medium',
      socTicket: true,
      status: 'Open,On Hold,Waiting on Customer,Escalated',
      year: 2026
    });
  });

  it('forwards pagination flags to the client', async () => {
    const { runtime, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'support-ticket',
      'list',
      '--alias',
      'prod',
      '--page-no',
      '2',
      '--per-page',
      '10'
    ]);

    expect(supportTicketStub.listTickets).toHaveBeenCalledWith({
      pageNo: 2,
      perPage: 10
    });
  });

  it('gets a ticket by id and emits human-readable output', async () => {
    const { runtime, stdout, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'support-ticket',
      'get',
      '42',
      '--alias',
      'prod'
    ]);

    expect(supportTicketStub.getTicket).toHaveBeenCalledWith(42, {});
    expect(stdout.buffer).toContain('T-100042');
    expect(stdout.buffer).toContain('Asha Iyer');
  });

  it('creates a ticket from required + optional flags and posts a normalized payload', async () => {
    const { runtime, stdout, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'support-ticket',
      'create',
      '--alias',
      'prod',
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
      '--resource',
      '2464:node-a:10.0.0.1',
      '--priority',
      'High',
      '--cc',
      'a@example.com',
      '--cc',
      'b@example.com'
    ]);

    expect(supportTicketStub.createTicket).toHaveBeenCalledWith({
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
    expect(JSON.parse(stdout.buffer)).toMatchObject({
      action: 'create',
      ticket: { id: 42, ticket_number: 'T-100042' }
    });
  });

  it('replies on a ticket with a normalized comment', async () => {
    const { runtime, stdout, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'support-ticket',
      'reply',
      '42',
      '--alias',
      'prod',
      '--comment',
      'Any update?'
    ]);

    expect(supportTicketStub.replyTicket).toHaveBeenCalledWith(42, {
      abuse_ticket: false,
      comment: 'Any update?',
      contact_person_email: '',
      contact_person_type: ''
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'reply',
        message: 'Reply posted.',
        ticket_id: 42
      })}\n`
    );
  });

  it('closes a ticket via the close subcommand', async () => {
    const { runtime, stdout, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'support-ticket',
      'close',
      '466',
      '--alias',
      'prod',
      '--comment',
      'thanks'
    ]);

    expect(supportTicketStub.closeTicket).toHaveBeenCalledWith(466, {
      comment: 'thanks'
    });
    expect(JSON.parse(stdout.buffer)).toMatchObject({
      action: 'close',
      ticket_id: 466
    });
  });

  it('lists replies via the replies subcommand', async () => {
    const { runtime, stdout, supportTicketStub } = createRuntimeFixture();
    await seedProfile(runtime);
    supportTicketStub.listReplies.mockResolvedValueOnce([
      {
        author: { email: 'engineer@example.com', name: 'Engineer' },
        canReply: true,
        channel: 'EMAIL',
        createdTime: '2026-05-13T16:09:19.307Z',
        direction: 'out',
        id: 'thread-1',
        summary: 'Hello',
        visibility: 'public'
      }
    ]);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'support-ticket',
      'replies',
      '466',
      '--alias',
      'prod'
    ]);

    expect(supportTicketStub.listReplies).toHaveBeenCalledWith(466, {});
    const parsed = JSON.parse(stdout.buffer) as {
      action: string;
      threads: Array<{ id: string }>;
    };
    expect(parsed.action).toBe('replies');
    expect(parsed.threads.map((thread) => thread.id)).toEqual(['thread-1']);
  });
});
