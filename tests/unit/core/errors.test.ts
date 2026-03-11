import { CliError, EXIT_CODES, formatError } from '../../../src/core/errors.js';

describe('formatError', () => {
  it('renders actionable CLI errors', () => {
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
});
