import { Command } from 'commander';

import type { CliRuntime } from '../app/runtime.js';
import { buildDbaasCommand } from './dbaas/index.js';
import { buildImageCommand } from './image/index.js';
import { buildLoadBalancerCommand } from './load-balancer/index.js';
import { buildNodeCommand } from './node/index.js';
import {
  buildMyAccountConfigureCommand,
  buildProjectCommand
} from './project/index.js';
import { buildReservedIpCommand } from './reserved-ip/index.js';
import { buildSecurityGroupCommand } from './security-group/index.js';
import { buildSshKeyCommand } from './ssh-key/index.js';
import { buildSslCommand } from './ssl/index.js';
import { buildSupportTicketCommand } from './support-ticket/index.js';
import { buildVolumeCommand } from './volume/index.js';
import { buildVpcCommand } from './vpc/index.js';

export function buildMyAccountCommand(runtime: CliRuntime): Command {
  const command = new Command('myaccount').description(
    'Manage E2E MyAccount resources: nodes, storage, networking, databases, load balancers, projects and support tickets.'
  );

  command.helpCommand('help [command]', 'Show help for a myaccount command');

  command.addCommand(buildMyAccountConfigureCommand(runtime));
  command.addCommand(buildProjectCommand(runtime));
  command.addCommand(buildDbaasCommand(runtime));
  command.addCommand(buildLoadBalancerCommand(runtime));
  command.addCommand(buildNodeCommand(runtime));
  command.addCommand(buildImageCommand(runtime));
  command.addCommand(buildReservedIpCommand(runtime));
  command.addCommand(buildVolumeCommand(runtime));
  command.addCommand(buildVpcCommand(runtime));
  command.addCommand(buildSecurityGroupCommand(runtime));
  command.addCommand(buildSshKeyCommand(runtime));
  command.addCommand(buildSslCommand(runtime));
  command.addCommand(buildSupportTicketCommand(runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
