import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderLoadBalancerResult } from './formatter.js';
import {
  LoadBalancerService,
  type LoadBalancerBackendGroupCreateOptions,
  type LoadBalancerBackendServerAddOptions,
  type LoadBalancerContextOptions,
  type LoadBalancerCreateOptions,
  type LoadBalancerDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

const LB_MODE_CHOICES = ['HTTP', 'HTTPS', 'BOTH', 'TCP'] as const;
const LB_ALGORITHM_CHOICES = ['roundrobin', 'leastconn', 'source'] as const;

export function buildLoadBalancerCommand(runtime: CliRuntime): Command {
  const service = new LoadBalancerService({
    confirm: (message) => runtime.confirm(message),
    createLoadBalancerClient: (credentials) =>
      runtime.createLoadBalancerClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });

  const command = new Command('load-balancer').description(
    'Manage MyAccount load balancers (ALB and NLB).'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a load-balancer command'
  );

  addContextOptions(
    command
      .command('list')
      .description('List load balancers for the selected profile.')
  ).action(
    async (options: LoadBalancerContextOptions, commandInstance: Command) => {
      const result = await service.listLoadBalancers(options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command.command('plans').description('List available load balancer plans.')
  ).action(
    async (options: LoadBalancerContextOptions, commandInstance: Command) => {
      const result = await service.listPlans(options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('create')
      .description(
        'Create a new load balancer. Use --mode HTTP, HTTPS, or BOTH for an ALB; use --mode TCP for an NLB. Run "load-balancer plans" first to see available plans.'
      )
      .requiredOption('--name <name>', 'Load balancer name.')
      .requiredOption(
        '--plan <plan>',
        'Load balancer plan identifier (e.g. LB-2). Run "load-balancer plans" to list available plans.'
      )
      .addOption(
        new Option(
          '--mode <mode>',
          'Load balancer mode. HTTP/HTTPS/BOTH creates an ALB; TCP creates an NLB.'
        )
          .choices(LB_MODE_CHOICES)
          .makeOptionMandatory()
      )
      .requiredOption(
        '--port <port>',
        'Frontend listener port (e.g. 80 for HTTP, 443 for HTTPS).'
      )
      .option(
        '--vpc <vpcId>',
        'VPC or network ID to attach the load balancer to. Use "load-balancer plans" to see available plans.'
      )
      .option('--backend-name <backendName>', 'Initial backend group name.')
      .option(
        '--server-ip <serverIp>',
        'Backend server IP address. Required when --backend-name is set.'
      )
      .option(
        '--server-port <serverPort>',
        'Backend server port. Defaults to --port.'
      )
      .option(
        '--server-name <serverName>',
        'Backend server identifier. Required when --backend-name is set.'
      )
      .addOption(
        new Option(
          '--algorithm <algorithm>',
          'Load balancing algorithm for the initial backend group.'
        )
          .choices(LB_ALGORITHM_CHOICES)
          .default('roundrobin')
      )
      .option(
        '--domain-name <domainName>',
        'Domain name for the initial backend group (ALB only).'
      )
      .option(
        '--http-check',
        'Enable HTTP health checks on the initial backend group (ALB only).'
      )
      .option(
        '--check-url <checkUrl>',
        'Health check path for the initial backend group.',
        '/'
      )
      .option(
        '--backend-port <backendPort>',
        'NLB backend group port. Defaults to --server-port.'
      )
  ).action(
    async (options: LoadBalancerCreateOptions, commandInstance: Command) => {
      const result = await service.createLoadBalancer(options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <lbId>')
      .description('Delete a load balancer.')
      .option('--force', 'Skip the interactive confirmation prompt.')
      .option(
        '--reserve-public-ip',
        "Preserve the load balancer's public IP as a reserved IP during deletion."
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteLoadBalancer(lbId, options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.addCommand(buildLoadBalancerBackendCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildLoadBalancerBackendCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('backend').description(
    'Manage backend groups and their servers on a load balancer.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a load-balancer backend command'
  );

  command.addCommand(buildLoadBalancerBackendGroupCommand(service, runtime));
  command.addCommand(buildLoadBalancerBackendServerCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildLoadBalancerBackendGroupCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('group').description(
    'Manage backend groups on a load balancer.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a load-balancer backend group command'
  );

  addContextOptions(
    command
      .command('list <lbId>')
      .description(
        'List all backend groups and their servers for a load balancer.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.listBackendGroups(lbId, options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('create <lbId>')
      .description(
        'Create a new backend group on a load balancer. For NLB, only one backend group is allowed.'
      )
      .requiredOption('--name <name>', 'Backend group name.')
      .addOption(
        new Option(
          '--algorithm <algorithm>',
          'Load balancing algorithm.'
        ).choices(LB_ALGORITHM_CHOICES)
      )
      .option(
        '--domain-name <domainName>',
        'Domain name for the backend group (ALB only).'
      )
      .option('--http-check', 'Enable HTTP health checks (ALB only).')
      .option('--check-url <checkUrl>', 'Health check path.', '/')
      .option('--backend-port <backendPort>', 'NLB backend group port.')
      .option('--server-ip <serverIp>', 'Optional initial server IP address.')
      .option('--server-port <serverPort>', 'Optional initial server port.')
      .option(
        '--server-name <serverName>',
        'Optional initial server identifier. Required when --server-ip is set.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendGroupCreateOptions,
      commandInstance: Command
    ) => {
      const result = await service.createBackendGroup(lbId, options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildLoadBalancerBackendServerCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('server').description(
    'Manage servers within backend groups on a load balancer.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a load-balancer backend server command'
  );

  addContextOptions(
    command
      .command('add <lbId>')
      .description('Add a server to an existing backend group.')
      .requiredOption(
        '--backend-name <backendName>',
        'Backend group name to add the server to.'
      )
      .requiredOption('--server-ip <serverIp>', 'Backend server IP address.')
      .requiredOption('--server-port <serverPort>', 'Backend server port.')
      .requiredOption(
        '--server-name <serverName>',
        'Unique identifier for this server within the backend group.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendServerAddOptions,
      commandInstance: Command
    ) => {
      const result = await service.addBackendServer(lbId, options);
      runtime.stdout.write(
        renderLoadBalancerResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
