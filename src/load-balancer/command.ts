import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderLoadBalancerResult } from './formatter.js';
import {
  LoadBalancerService,
  type LoadBalancerBackendGroupCreateOptions,
  type LoadBalancerBackendGroupUpdateOptions,
  type LoadBalancerBackendServerAddOptions,
  type LoadBalancerBackendServerDeleteOptions,
  type LoadBalancerBackendServerUpdateOptions,
  type LoadBalancerContextOptions,
  type LoadBalancerCreateOptions,
  type LoadBalancerDeleteOptions,
  type LoadBalancerUpdateOptions,
  type LoadBalancerVpcAttachOptions,
  type LoadBalancerVpcDetachOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

const FRONTEND_PROTOCOL_CHOICES = ['HTTP', 'HTTPS', 'BOTH', 'TCP'] as const;
const LB_ALGORITHM_CHOICES = ['roundrobin', 'leastconn', 'source'] as const;
const ALB_BACKEND_PROTOCOL_CHOICES = ['HTTP', 'HTTPS'] as const;
const LB_BILLING_TYPE_CHOICES = ['hourly', 'committed'] as const;

export function buildLoadBalancerCommand(runtime: CliRuntime): Command {
  const service = new LoadBalancerService({
    confirm: (message) => runtime.confirm(message),
    createLoadBalancerClient: (credentials) =>
      runtime.createLoadBalancerClient(credentials),
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });

  const command = new Command('lb').description(
    'Manage MyAccount load balancers (ALB and NLB).'
  );

  command.helpCommand('help [command]', 'Show help for an lb command');

  addContextOptions(
    command
      .command('list')
      .description('List load balancers for the selected profile.')
  ).action(
    async (options: LoadBalancerContextOptions, commandInstance: Command) => {
      const result = await service.listLoadBalancers(options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command.command('plans').description('List available load balancer plans.')
  ).action(
    async (options: LoadBalancerContextOptions, commandInstance: Command) => {
      const result = await service.listPlans(options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command.command('get <lbId>').description('Get load balancer details.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getLoadBalancer(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('create')
      .description(
        'Create a load balancer with one backend group and one or more backend servers.'
      )
      .requiredOption('--name <name>', 'Load balancer name.')
      .requiredOption(
        '--plan <plan>',
        'Load balancer base plan name exactly as shown by "lb plans".'
      )
      .addOption(
        new Option(
          '--frontend-protocol <protocol>',
          'Frontend protocol. HTTP/HTTPS/BOTH creates an ALB; TCP creates an NLB.'
        )
          .choices(FRONTEND_PROTOCOL_CHOICES)
          .makeOptionMandatory()
      )
      .requiredOption('--port <port>', 'Frontend listener port.')
      .addOption(
        new Option(
          '--billing-type <billingType>',
          'Billing type for the load balancer.'
        ).choices(LB_BILLING_TYPE_CHOICES)
      )
      .option(
        '--committed-plan <name>',
        'Committed plan name for the selected base plan.'
      )
      .option(
        '--committed-plan-id <id>',
        'Committed plan ID for the selected base plan.'
      )
      .addOption(
        new Option(
          '--post-commit-behavior <behavior>',
          'What should happen after the committed term ends.'
        ).choices(['auto-renew', 'hourly-billing'])
      )
      .option(
        '--vpc <vpcId>',
        'VPC or network ID to attach. Creates an internal load balancer.'
      )
      .option('--subnet <subnetId>', 'Subnet ID for --vpc.')
      .requiredOption('--backend-group <name>', 'Initial backend group name.')
      .requiredOption(
        '--backend-server <name:ip:port>',
        'Initial backend server. Repeat for multiple servers.',
        collectValues,
        []
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
          'Backend protocol for ALB backend groups.'
        ).choices(ALB_BACKEND_PROTOCOL_CHOICES)
      )
      .option(
        '--reserve-ip <ip>',
        'Reserved public IP to attach to an external load balancer.'
      )
      .option(
        '--ssl-certificate-id <id>',
        'SSL certificate ID. Required for HTTPS or BOTH.'
      )
      .option(
        '--security-group <securityGroupId>',
        'Security group ID to attach to the load balancer.'
      )
  ).action(
    async (options: LoadBalancerCreateOptions, commandInstance: Command) => {
      const result = await service.createLoadBalancer(options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('update <lbId>')
      .description('Update LB-level settings.')
      .option('--name <name>', 'New load balancer name.')
      .addOption(
        new Option(
          '--frontend-protocol <protocol>',
          'ALB frontend protocol: HTTP, HTTPS, or BOTH.'
        ).choices(FRONTEND_PROTOCOL_CHOICES)
      )
      .option('--ssl-certificate-id <id>', 'SSL certificate ID for ALB.')
      .option(
        '--redirect-http-to-https',
        'Redirect HTTP to HTTPS. Valid only with BOTH.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.updateLoadBalancer(lbId, options);
      writeResult(runtime, commandInstance, result);
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
      writeResult(runtime, commandInstance, result);
    }
  );

  command.addCommand(buildNetworkCommand(service, runtime));
  command.addCommand(buildBackendGroupCommand(service, runtime));
  command.addCommand(buildBackendServerCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildNetworkCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('network').description(
    'Manage load balancer network attachments.'
  );
  command.helpCommand('help [command]', 'Show help for lb network commands');
  command.addCommand(buildReserveIpCommand(service, runtime));
  command.addCommand(buildVpcCommand(service, runtime));
  command.action(() => {
    command.outputHelp();
  });
  return command;
}

function buildReserveIpCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('reserve-ip').description(
    'Manage a load balancer reserved public IP attachment.'
  );

  addContextOptions(
    command
      .command('attach <lbId> <ip>')
      .description('Attach a reserved public IP to an external load balancer.')
  ).action(
    async (
      lbId: string,
      ip: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.attachReserveIp(lbId, ip, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('detach <lbId>')
      .description('Detach the reserved public IP from a load balancer.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.detachReserveIp(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  command.action(() => {
    command.outputHelp();
  });
  return command;
}

function buildVpcCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('vpc').description(
    'Manage load balancer VPC attachment.'
  );

  addContextOptions(
    command
      .command('attach <lbId>')
      .description('Attach a load balancer to a VPC.')
      .requiredOption('--vpc <vpcId>', 'VPC or network ID to attach.')
      .option('--subnet <subnetId>', 'Subnet ID to attach.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerVpcAttachOptions,
      commandInstance: Command
    ) => {
      const result = await service.attachVpc(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('detach <lbId>')
      .description('Detach a load balancer from a VPC.')
      .requiredOption('--vpc <vpcId>', 'VPC or network ID to detach.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerVpcDetachOptions,
      commandInstance: Command
    ) => {
      const result = await service.detachVpc(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  command.action(() => {
    command.outputHelp();
  });
  return command;
}

function buildBackendGroupCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('backend-group').description(
    'Manage backend groups on a load balancer.'
  );

  addContextOptions(
    command
      .command('add <lbId>')
      .description('Add a backend group to a load balancer.')
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
        ).choices(ALB_BACKEND_PROTOCOL_CHOICES)
      )
      .requiredOption(
        '--backend-server <name:ip:port>',
        'Initial backend server. Repeat for multiple servers.',
        collectValues,
        []
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendGroupCreateOptions,
      commandInstance: Command
    ) => {
      const result = await service.createBackendGroup(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('update <lbId> <groupName>')
      .description('Update a backend group.')
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
        ).choices(ALB_BACKEND_PROTOCOL_CHOICES)
      )
  ).action(
    async (
      lbId: string,
      groupName: string,
      options: LoadBalancerBackendGroupUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.updateBackendGroup(lbId, groupName, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('remove <lbId> <groupName>')
      .description('Remove a backend group from a load balancer.')
  ).action(
    async (
      lbId: string,
      groupName: string,
      options: LoadBalancerContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteBackendGroup(lbId, groupName, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  command.action(() => {
    command.outputHelp();
  });
  return command;
}

function buildBackendServerCommand(
  service: LoadBalancerService,
  runtime: CliRuntime
): Command {
  const command = new Command('backend-server').description(
    'Manage backend servers on a load balancer.'
  );

  addContextOptions(
    command
      .command('add <lbId>')
      .description('Add a server to an existing backend group.')
      .requiredOption(
        '--backend-group <name>',
        'Backend group name to add the server to.'
      )
      .requiredOption('--backend-server <name:ip:port>', 'Backend server.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendServerAddOptions,
      commandInstance: Command
    ) => {
      const result = await service.addBackendServer(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('update <lbId>')
      .description('Update a backend server.')
      .requiredOption('--backend-group <name>', 'Backend group name.')
      .requiredOption(
        '--backend-server-name <name>',
        'Backend server name to update.'
      )
      .option('--ip <ip>', 'New backend server IP address.')
      .option('--port <port>', 'New backend server port.')
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendServerUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.updateBackendServer(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  addContextOptions(
    command
      .command('remove <lbId>')
      .description('Remove a server from an existing backend group.')
      .requiredOption('--backend-group <name>', 'Backend group name.')
      .requiredOption(
        '--backend-server-name <name>',
        'Backend server name to remove.'
      )
  ).action(
    async (
      lbId: string,
      options: LoadBalancerBackendServerDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteBackendServer(lbId, options);
      writeResult(runtime, commandInstance, result);
    }
  );

  command.action(() => {
    command.outputHelp();
  });
  return command;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function writeResult(
  runtime: CliRuntime,
  commandInstance: Command,
  result: Parameters<typeof renderLoadBalancerResult>[0]
): void {
  runtime.stdout.write(
    renderLoadBalancerResult(
      result,
      commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
    )
  );
}
