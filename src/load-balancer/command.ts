import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderLoadBalancerResult } from './formatter.js';
import {
  LoadBalancerService,
  type LoadBalancerBackendGroupCreateOptions,
  type LoadBalancerBackendServerAddOptions,
  type LoadBalancerBackendServerDeleteOptions,
  type LoadBalancerContextOptions,
  type LoadBalancerCreateOptions,
  type LoadBalancerDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

const LB_MODE_CHOICES = ['HTTP', 'HTTPS', 'BOTH', 'TCP'] as const;
const LB_ALGORITHM_CHOICES = ['roundrobin', 'leastconn', 'source'] as const;
const ALB_BACKEND_PROTOCOL_CHOICES = ['HTTP', 'HTTPS'] as const;

export function buildLoadBalancerCommand(runtime: CliRuntime): Command {
  const service = new LoadBalancerService({
    confirm: (message) => runtime.confirm(message),
    createLoadBalancerClient: (credentials) =>
      runtime.createLoadBalancerClient(credentials),
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
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
        'Create a new load balancer. Use --mode HTTP, HTTPS, or BOTH for an ALB; use --mode TCP for an NLB. Run "load-balancer plans" first to inspect base plans and any committed options.'
      )
      .requiredOption('--name <name>', 'Load balancer name.')
      .requiredOption(
        '--plan <plan>',
        'Load balancer base plan name exactly as shown by "load-balancer plans" (for example E2E-LB-2).'
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
        '--committed-plan <name>',
        'Committed plan name for the selected base plan, exactly as shown in "load-balancer plans".'
      )
      .option(
        '--committed-plan-id <id>',
        'Committed plan ID for the selected base plan. Useful with "load-balancer plans --json".'
      )
      .addOption(
        new Option(
          '--post-commit-behavior <behavior>',
          'What should happen after the committed term ends. Defaults to auto-renew.'
        ).choices(['auto-renew', 'hourly-billing'])
      )
      .option(
        '--vpc <vpcId>',
        'VPC or network ID to attach the load balancer to. This creates an internal load balancer.'
      )
      .requiredOption(
        '--backend-name <backendName>',
        'Initial backend group name.'
      )
      .requiredOption('--server-ip <serverIp>', 'Backend server IP address.')
      .option(
        '--server-port <serverPort>',
        'Backend server port. Defaults to --port.'
      )
      .requiredOption(
        '--server-name <serverName>',
        'Backend server identifier.'
      )
      .addOption(
        new Option(
          '--algorithm <algorithm>',
          'Load balancing algorithm for the initial backend group.'
        )
          .choices(LB_ALGORITHM_CHOICES)
          .default('roundrobin')
      )
      .addOption(
        new Option(
          '--backend-protocol <protocol>',
          'Backend protocol for the initial ALB backend group.'
        )
          .choices(ALB_BACKEND_PROTOCOL_CHOICES)
          .default('HTTP')
      )
      .option(
        '--http-check',
        'Enable HTTP health checks on the initial backend group (ALB only).'
      )
      .option(
        '--backend-port <backendPort>',
        'NLB backend group port. Defaults to --server-port.'
      )
      .option(
        '--ssl-certificate-id <id>',
        'SSL certificate ID to attach. Required when --mode is HTTPS or BOTH.'
      )
      .option(
        '--security-group <securityGroupId>',
        'Security group ID to attach to the load balancer.'
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
      .command('delete <lbId> <groupName>')
      .description('Delete a backend group from a load balancer.')
  ).action(
    async (
      lbId: string,
      groupName: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteBackendGroup(lbId, groupName, options);
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
      .addOption(
        new Option(
          '--backend-protocol <protocol>',
          'Backend protocol for ALB backend groups.'
        )
          .choices(ALB_BACKEND_PROTOCOL_CHOICES)
          .default('HTTP')
      )
      .option('--http-check', 'Enable HTTP health checks (ALB only).')
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
      .command('list <lbId> <groupName>')
      .description('List all servers in a backend group.')
  ).action(
    async (
      lbId: string,
      groupName: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.listBackendServers(lbId, groupName, options);
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

  addContextOptions(
    command
      .command('delete <lbId>')
      .description('Delete a server from an existing backend group.')
      .requiredOption(
        '--backend-name <backendName>',
        'Backend group name to remove the server from.'
      )
      .requiredOption(
        '--server-name <serverName>',
        'Server identifier to remove from the backend group.'
      )
      .option(
        '--server-ip <serverIp>',
        'Optional server IP to disambiguate duplicate server names.'
      )
      .option(
        '--server-port <serverPort>',
        'Optional server port to disambiguate duplicate server names.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendServerDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteBackendServer(lbId, options);
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
