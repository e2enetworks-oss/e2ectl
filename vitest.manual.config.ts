import { defineConfig } from 'vitest/config';

const MANUAL_READ_ONLY_TEST_TIMEOUT_MS = 10 * 60 * 1000;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/manual/read-only/**/*.test.ts'],
    testTimeout: MANUAL_READ_ONLY_TEST_TIMEOUT_MS
  }
});
