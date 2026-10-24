import type { Command } from 'commander';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';

// Every runnable command, written as typed after `e2ectl`. A command lost or
// renamed by mistake fails here.
const EXPECTED_COMMANDS = [
  'config import',
  'config list',
  'config set-context',
  'config set-default',
  'config remove',
  'myaccount project list',
  'myaccount project create',
  'myaccount project star',
  'myaccount project unstar',
  'myaccount dbaas types',
  'myaccount dbaas plans',
  'myaccount dbaas list',
  'myaccount dbaas get',
  'myaccount dbaas create',
  'myaccount dbaas network vpc attach',
  'myaccount dbaas network vpc detach',
  'myaccount dbaas network public-ip attach',
  'myaccount dbaas network public-ip detach',
  'myaccount dbaas whitelist list',
  'myaccount dbaas whitelist add',
  'myaccount dbaas whitelist remove',
  'myaccount dbaas reset-password',
  'myaccount dbaas delete',
  'myaccount lb list',
  'myaccount lb plans',
  'myaccount lb get',
  'myaccount lb create',
  'myaccount lb update',
  'myaccount lb delete',
  'myaccount lb network reserve-ip reserve',
  'myaccount lb network vpc attach',
  'myaccount lb network vpc detach',
  'myaccount lb backend group list',
  'myaccount lb backend group add',
  'myaccount lb backend group update',
  'myaccount lb backend group remove',
  'myaccount lb backend server add',
  'myaccount lb backend server remove',
  'myaccount node catalog os',
  'myaccount node catalog plans',
  'myaccount node action power-on',
  'myaccount node action power-off',
  'myaccount node action save-image',
  'myaccount node action public-ip detach',
  'myaccount node action vpc attach',
  'myaccount node action vpc detach',
  'myaccount node action volume attach',
  'myaccount node action volume detach',
  'myaccount node action security-group attach',
  'myaccount node action security-group detach',
  'myaccount node action ssh-key attach',
  'myaccount node list',
  'myaccount node create',
  'myaccount node get',
  'myaccount node upgrade',
  'myaccount node delete',
  'myaccount image list',
  'myaccount image delete',
  'myaccount image rename',
  'myaccount reserved-ip list',
  'myaccount reserved-ip get',
  'myaccount reserved-ip create',
  'myaccount reserved-ip reserve node',
  'myaccount reserved-ip attach node',
  'myaccount reserved-ip detach node',
  'myaccount reserved-ip delete',
  'myaccount volume list',
  'myaccount volume plans',
  'myaccount volume create',
  'myaccount volume get',
  'myaccount volume delete',
  'myaccount vpc list',
  'myaccount vpc plans',
  'myaccount vpc create',
  'myaccount vpc get',
  'myaccount vpc delete',
  'myaccount security-group list',
  'myaccount security-group get',
  'myaccount security-group create',
  'myaccount security-group update',
  'myaccount security-group delete',
  'myaccount ssh-key list',
  'myaccount ssh-key create',
  'myaccount ssh-key get',
  'myaccount ssh-key delete',
  'myaccount ssl list',
  'myaccount support-ticket list',
  'myaccount support-ticket get',
  'myaccount support-ticket get-replies',
  'myaccount support-ticket departments',
  'myaccount support-ticket timeline',
  'myaccount support-ticket create',
  'myaccount support-ticket reply',
  'myaccount support-ticket close',
  'myaccount support-ticket reopen'
];

function listRunnableCommands(
  command: Command,
  prefix: string[] = []
): string[] {
  const children = command.commands.filter((child) => child.name() !== 'help');

  if (children.length === 0) {
    return [prefix.join(' ')];
  }

  return children.flatMap((child) =>
    listRunnableCommands(child, [...prefix, child.name()])
  );
}

describe('createProgram', () => {
  it('has config and myaccount at the top level', () => {
    const program = createProgram();

    expect(program.name()).toBe(CLI_COMMAND_NAME);
    expect(program.commands.map((command) => command.name())).toEqual([
      'config',
      'myaccount'
    ]);
  });

  it('registers every command under its expected name', () => {
    const commands = listRunnableCommands(createProgram());

    expect(commands).toHaveLength(95);
    expect(commands).toEqual(EXPECTED_COMMANDS);
  });
});
