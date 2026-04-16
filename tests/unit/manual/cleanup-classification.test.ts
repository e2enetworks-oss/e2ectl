import {
  classifyCleanupError,
  classifyCleanupMessage
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
