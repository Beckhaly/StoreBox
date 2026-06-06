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
    globalSetup:  './src/test/globalSetup.ts',
    setupFiles:   ['./src/test/setup.ts'],
    testTimeout:  30_000,
    hookTimeout:  30_000,
    include:      ['src/__tests__/integration/**/*.test.ts'],
    sequence:     { concurrent: false },
    pool:         'forks',
    maxWorkers:   1, // fichiers DB en série (évite TRUNCATE croisé entre workers)
  },
});
