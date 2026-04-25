import {
  AppError,
  CliError,
  EXIT_CODES,
  formatError
} from '../../../src/core/errors.js';

describe('formatError', () => {
  it('renders actionable shared errors', () => {
    const message = formatError(
      new AppError('Unable to resolve credentials.', {
        code: 'AUTH',
        details: ['Missing api_key', 'Missing auth_token'],
        exitCode: EXIT_CODES.auth,
        suggestion: 'Set E2E_API_KEY and E2E_AUTH_TOKEN.'
      })
    );

    expect(message).toContain('Error: Unable to resolve credentials.');
    expect(message).toContain('Details:');
    expect(message).toContain('Next step: Set E2E_API_KEY and E2E_AUTH_TOKEN.');
  });

  it('preserves CliError formatting compatibility', () => {
    const message = formatError(
      new CliError('Unable to resolve credentials.', {
        code: 'AUTH',
        details: ['Missing api_key', 'Missing auth_token'],
        exitCode: EXIT_CODES.auth,
        suggestion: 'Set E2E_API_KEY and E2E_AUTH_TOKEN.'
      })
    );

    expect(message).toContain('Error: Unable to resolve credentials.');
    expect(message).toContain('Details:');
    expect(message).toContain('Next step: Set E2E_API_KEY and E2E_AUTH_TOKEN.');
  });

  it('formats AppError without details or suggestion', () => {
    const message = formatError(
      new AppError('Something went wrong.', {
        code: 'GENERAL'
      })
    );

    expect(message).toBe('Error: Something went wrong.\n');
  });

  it('formats a plain Error as an unexpected error', () => {
    const message = formatError(new Error('connection refused'));

    expect(message).toBe('Unexpected error: connection refused\n');
  });

  it('formats an unknown non-Error value as a generic unexpected error', () => {
    const message = formatError('not an error object');

    expect(message).toBe('Unexpected error: an unknown failure occurred.\n');
  });
});
