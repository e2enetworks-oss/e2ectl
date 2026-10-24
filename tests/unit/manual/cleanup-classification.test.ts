import {
  classifyCleanupError,
  classifyCleanupMessage,
  formatError,
  isBusyRefusal
} from '../../../scripts/helpers/manual-smoke-cleanup.mjs';

describe('manual smoke cleanup classification', () => {
  it('treats already-gone cleanup messages as non-fatal', () => {
    expect(classifyCleanupMessage('Security group not found.')).toBe(
      'already-gone'
    );
    expect(classifyCleanupMessage('Reserved IP was already gone.')).toBe(
      'already-gone'
    );
  });

  it('treats other cleanup failures as retryable', () => {
    expect(classifyCleanupMessage('Gateway timeout from API')).toBe(
      'retryable'
    );
    expect(classifyCleanupError(new Error('500 Internal Server Error'))).toBe(
      'retryable'
    );
  });
});

describe('isBusyRefusal', () => {
  it('retries while E2E says the node is busy', () => {
    expect(
      isBusyRefusal(
        'Errors: "Invalid node state to perform \'Delete\' action."'
      )
    ).toBe(true);
  });

  it.each([
    '- HTTP status: 500 Internal Server Error',
    'Errors: "Invalid node state to perform \'Delete\' action."',
    'Errors: "Failed to detach vpc. Please try again after some time."',
    'Errors: "YOU HAVE RUNNING SERVERS ON THIS VPC"'
  ])('treats E2E saying it is busy as busy: %s', (message) => {
    expect(isBusyRefusal(message)).toBe(true);
  });

  it('does not treat the CLI error footer alone as busy', () => {
    expect(
      isBusyRefusal('Next step: Check the request inputs and try again.')
    ).toBe(false);
  });

  it('does not treat other failures as busy', () => {
    expect(isBusyRefusal('Node not found.')).toBe(false);
  });
});

describe('classifyCleanupError with API details', () => {
  it('does not treat a 404 status line in the details as already gone', () => {
    const error = Object.assign(
      new Error('MyAccount API request failed: Bad Request'),
      { details: ['HTTP status: 404 Not Found', 'Path: /nodes/1/'] }
    );

    expect(classifyCleanupError(error)).toBe('retryable');
  });
});

describe('formatError', () => {
  it('adds the error details after the message', () => {
    const error = Object.assign(
      new Error('MyAccount API request failed: Bad Request'),
      { details: ['YOU HAVE RUNNING SERVERS ON THIS VPC', 'second detail'] }
    );

    expect(formatError(error)).toBe(
      'MyAccount API request failed: Bad Request\nYOU HAVE RUNNING SERVERS ON THIS VPC\nsecond detail'
    );
  });

  it('uses the message alone when there are no string details', () => {
    expect(formatError(new Error('plain failure'))).toBe('plain failure');
    expect(
      formatError(Object.assign(new Error('odd details'), { details: [42] }))
    ).toBe('odd details');
    expect(formatError('not an error')).toBe('not an error');
  });
});
