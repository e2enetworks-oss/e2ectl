import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderSupportTicketResult } from './formatter.js';
import { SupportTicketService } from './service.js';
import type {
  SupportTicketCloseOptions,
  SupportTicketCreateOptions,
  SupportTicketGetOptions,
  SupportTicketListOptions,
  SupportTicketReplyOptions
} from './types/index.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildSupportTicketCommand(runtime: CliRuntime): Command {
  const service = new SupportTicketService({
    createSupportTicketClient: (credentials) =>
      runtime.createSupportTicketClient(credentials),
    readAttachmentFile: async (path) => await readFile(path),
    store: runtime.store
  });
  const command = new Command('support-ticket').description(
    'Manage MyAccount support tickets.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a support-ticket command'
  );

  addContextOptions(
    command
      .command('list')
      .description('List support tickets for the authenticated customer.')
      .option('--page-no <pageNo>', 'Page number (1-based).')
      .option('--per-page <perPage>', 'Page size.')
      .option(
        '--category <categories>',
        'Comma-separated. One or more of: Cloud, Network, Billing, Sales, SOC, Abuse. SOC and Abuse are sent as boolean filters.'
      )
      .option(
        '--status <statuses>',
        'Status filter. Presets: open (Open,On Hold,Waiting on Customer,Escalated), resolved (Resolved,Closed). Or pass a comma-separated list of: New, Open, On Hold, Waiting on Customer, Escalated, Resolved, Closed.'
      )
      .option(
        '--priority <priorities>',
        'Priority filter. Preset: urgent (High,Medium). Or pass a comma-separated list of: High, Medium, Low.'
      )
      .option(
        '--year <year>',
        'Restrict results to tickets opened in this year.'
      )
      .option(
        '--contact-email <email>',
        'Restrict results to tickets with this contact person email.'
      )
      .option(
        '--contact-type <type>',
        'Restrict results to a contact person type: Technical Lead, Billing, Manager, or Admin.'
      )
  ).action(
    async (options: SupportTicketListOptions, commandInstance: Command) => {
      const result = await service.listTickets(options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('get <ticketId>')
      .description('Get details for one support ticket by its local id.')
      .option(
        '--contact-email <email>',
        'Contact person email to scope the request.'
      )
      .option(
        '--contact-type <type>',
        'Contact person type: Technical Lead, Billing, Manager, or Admin.'
      )
  ).action(
    async (
      ticketId: string,
      options: SupportTicketGetOptions,
      commandInstance: Command
    ) => {
      const result = await service.getTicket(ticketId, options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('replies <ticketId>')
      .description(
        'List the conversation threads (comments + replies) on a ticket.'
      )
      .option(
        '--contact-email <email>',
        'Contact person email to scope the request.'
      )
      .option(
        '--contact-type <type>',
        'Contact person type: Technical Lead, Billing, Manager, or Admin.'
      )
  ).action(
    async (
      ticketId: string,
      options: SupportTicketGetOptions,
      commandInstance: Command
    ) => {
      const result = await service.getReplies(ticketId, options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.addCommand(buildSupportTicketCreateCommand(service, runtime));
  command.addCommand(buildSupportTicketReplyCommand(service, runtime));
  command.addCommand(buildSupportTicketCloseCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildSupportTicketCreateCommand(
  service: SupportTicketService,
  runtime: CliRuntime
): Command {
  const command = addContextOptions(
    new Command('create').description('Open a new support ticket.')
  )
    .requiredOption(
      '--department <departmentId>',
      'Numeric department id (see ticket_management departments).'
    )
    .requiredOption('--subject <subject>', 'Ticket subject (<= 256 chars).')
    .requiredOption(
      '--description <description>',
      'Ticket description (<= 6000 chars).'
    )
    .requiredOption(
      '--ticket-category <category>',
      'One of: Cloud, Network, Billing, Sales.'
    )
    .option(
      '--component <component>',
      'Affected service / component. Required for Cloud and Billing categories.'
    )
    .option(
      '--resource <spec>',
      'Resource affected, in id:name[:ip] form. Repeat for multiple resources. Cloud only.',
      collectValues,
      []
    )
    .option(
      '--priority <priority>',
      'Severity. One of: High, Medium, Low. Required for Cloud and Billing categories. Ignored for Sales.'
    )
    .option(
      '--cc <email>',
      'CC email address. Repeat the flag for multiple addresses.',
      collectValues,
      []
    )
    .option(
      '--attachment <path>',
      'Attach a file (read from disk and base64-encoded). Repeat for multiple attachments.',
      collectValues,
      []
    )
    .option(
      '--contact-email <email>',
      'Contact person email (defaults to account owner if omitted).'
    )
    .option(
      '--contact-type <type>',
      'Contact person type: Technical Lead, Billing, Manager, or Admin.'
    )
    .option(
      '--priority-ticket',
      'Mark this ticket as a priority (chat) ticket.'
    )
    .option('--channel <channel>', 'Origin channel (defaults to Web).');

  command.action(
    async (options: SupportTicketCreateOptions, commandInstance: Command) => {
      const result = await service.createTicket(options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  return command;
}

function buildSupportTicketReplyCommand(
  service: SupportTicketService,
  runtime: CliRuntime
): Command {
  const command = addContextOptions(
    new Command('reply')
      .description('Post a reply on an existing support ticket.')
      .argument('<ticketId>', 'Support ticket id.')
  )
    .requiredOption('--comment <comment>', 'Reply body (<= 6000 chars).')
    .option('--channel <channel>', 'Reply channel (e.g. Email, Web).')
    .option(
      '--attachment <path>',
      'Attach a file (read from disk and base64-encoded). Repeat for multiple attachments.',
      collectValues,
      []
    )
    .option(
      '--contact-email <email>',
      'Contact person email scope for the reply.'
    )
    .option(
      '--contact-type <type>',
      'Contact person type: Technical Lead, Billing, Manager, or Admin.'
    )
    .option(
      '--abuse-ticket',
      'Flag this reply as belonging to an abuse ticket.'
    );

  command.action(
    async (
      ticketId: string,
      options: SupportTicketReplyOptions,
      commandInstance: Command
    ) => {
      const result = await service.replyTicket(ticketId, options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  return command;
}

function buildSupportTicketCloseCommand(
  service: SupportTicketService,
  runtime: CliRuntime
): Command {
  const command = addContextOptions(
    new Command('close')
      .description('Post a closing comment on a ticket and resolve it.')
      .argument('<ticketId>', 'Support ticket id.')
  )
    .requiredOption('--comment <comment>', 'Closing comment (<= 6000 chars).')
    .option(
      '--contact-email <email>',
      'Contact person email scope for the closing comment.'
    )
    .option(
      '--contact-type <type>',
      'Contact person type: Technical Lead, Billing, Manager, or Admin.'
    );

  command.action(
    async (
      ticketId: string,
      options: SupportTicketCloseOptions,
      commandInstance: Command
    ) => {
      const result = await service.closeTicket(ticketId, options);
      runtime.stdout.write(
        renderSupportTicketResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  return command;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}
