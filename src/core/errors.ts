export const EXIT_CODES = {
  success: 0,
  general: 1,
  usage: 2,
  auth: 3,
  config: 4,
  network: 5
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export interface CliErrorOptions {
  cause?: unknown;
  code: string;
  details?: string[];
  exitCode?: ExitCode;
  suggestion?: string;
}

export class CliError extends Error {
  override readonly name = 'CliError';
  override readonly cause: unknown;
  readonly code: string;
  readonly details: string[];
  readonly exitCode: ExitCode;
  readonly suggestion: string | undefined;

  constructor(message: string, options: CliErrorOptions) {
    super(message);
    this.code = options.code;
    this.exitCode = options.exitCode ?? EXIT_CODES.general;
    this.details = options.details ?? [];
    this.suggestion = options.suggestion;
    this.cause = options.cause;
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}

export function formatError(error: unknown): string {
  if (isCliError(error)) {
    const lines = [`Error: ${error.message}`];

    if (error.details.length > 0) {
      lines.push('');
      lines.push('Details:');
      lines.push(...error.details.map((detail) => `- ${detail}`));
    }

    if (error.suggestion !== undefined) {
      lines.push('');
      lines.push(`Next step: ${error.suggestion}`);
    }

    return `${lines.join('\n')}\n`;
  }

  if (error instanceof Error) {
    return `Unexpected error: ${error.message}\n`;
  }

  return 'Unexpected error: an unknown failure occurred.\n';
}
