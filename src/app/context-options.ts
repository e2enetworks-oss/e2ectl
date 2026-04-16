import { Command } from 'commander';

export function addAliasOption<TCommand extends Command>(
  command: TCommand
): TCommand {
  return command.option(
    '--alias <alias>',
    'Saved profile alias to use for this command.'
  );
}

export function addContextOptions<TCommand extends Command>(
  command: TCommand
): TCommand {
  return addAliasOption(command)
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.');
}
