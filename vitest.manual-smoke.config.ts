import { defineConfig } from 'vitest/config';

const MANUAL_SMOKE_TEST_TIMEOUT_MS = 30 * 60 * 1000;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/manual/smoke/**/*.test.ts'],
    testTimeout: MANUAL_SMOKE_TEST_TIMEOUT_MS
  }
});
