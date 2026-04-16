export const EXIT_CODES = {
  success: 0,
  general: 1,
  usage: 2,
  auth: 3,
  config: 4,
  network: 5
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export interface AppErrorOptions {
  cause?: unknown;
  code: string;
  details?: string[];
  exitCode?: ExitCode;
  suggestion?: string;
}

export class AppError extends Error {
  override readonly name: string = 'AppError';
  override readonly cause: unknown;
  readonly code: string;
  readonly details: string[];
  readonly exitCode: ExitCode;
  readonly suggestion: string | undefined;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.code = options.code;
    this.exitCode = options.exitCode ?? EXIT_CODES.general;
    this.details = options.details ?? [];
    this.suggestion = options.suggestion;
    this.cause = options.cause;
  }
}

export type CliErrorOptions = AppErrorOptions;

export class CliError extends AppError {
  override readonly name: string = 'CliError';
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isCliError(error: unknown): error is AppError {
  return isAppError(error);
}

export function formatError(error: unknown): string {
  if (isAppError(error)) {
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
