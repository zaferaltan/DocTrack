import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@preload': resolve('src/preload'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
