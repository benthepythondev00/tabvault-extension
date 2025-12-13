import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    sequence: {
      shuffle: false,
      concurrent: false,
    },
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    alias: {
      'wxt/utils/storage': path.resolve(__dirname, 'src/test/mocks/wxt-storage.ts'),
    },
  },
});
