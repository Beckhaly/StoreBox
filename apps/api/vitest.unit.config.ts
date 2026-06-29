import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://storebox:TelePro2026!@localhost:5433/storebox_test',
      JWT_SECRET:   'test-secret-for-vitest-only-padded-to-64-chars-xxxxxxxxxxxxxxxxx',
      NODE_ENV:     'test',
    },
    include:  ['src/__tests__/unit/**/*.test.ts'],
    sequence: { concurrent: false },
  },
});
