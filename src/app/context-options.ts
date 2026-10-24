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

// TIR commands that work inside a project. Each flag wins over its
// E2E_TIR_* environment variable and over the profile's saved TIR context.
export function addTirContextOptions<TCommand extends Command>(
  command: TCommand
): TCommand {
  return addAliasOption(command)
    .option(
      '--account-id <accountId>',
      'TIR account id for this command (from tir account list).'
    )
    .option(
      '--project-id <projectId>',
      'TIR project id for this command (from tir project list).'
    )
    .option(
      '--location <location>',
      'TIR location for this command: Delhi or Chennai.'
    );
}
