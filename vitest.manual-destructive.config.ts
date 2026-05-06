import { defineConfig } from 'vitest/config';

const MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS = 30 * 60 * 1000;

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globals: true,
    include: ['tests/manual/destructive/**/*.test.ts'],
    testTimeout: MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS
  }
});
