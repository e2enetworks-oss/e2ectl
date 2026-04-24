import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage/unit',
      exclude: ['**/types.ts', 'scripts/**', 'tests/**'],
      thresholds: {
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
