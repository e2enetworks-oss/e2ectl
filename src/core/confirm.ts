import { CliError, EXIT_CODES } from './errors.js';

export interface ConfirmIo {
  confirm(message: string): Promise<boolean>;
  isInteractive: boolean;
}

// Asks before a change that cannot be undone. --force skips the question.
// Without a terminal (a script or an agent) nothing is asked: the command
// fails and says to add --force.
export async function confirmUnlessForced(
  io: ConfirmIo,
  force: boolean | undefined,
  question: string
): Promise<boolean> {
  if (force ?? false) {
    return true;
  }

  if (!io.isInteractive) {
    throw new CliError(
      'This command needs confirmation in an interactive terminal.',
      {
        code: 'CONFIRMATION_REQUIRED',
        details: [question],
        exitCode: EXIT_CODES.usage,
        suggestion: 'Re-run the command with --force to skip the prompt.'
      }
    );
  }

  return await io.confirm(question);
}
