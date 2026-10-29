import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': resolve(__dirname) } },
  test: { include: ['**/*.test.ts', '**/*.test.tsx'], exclude: ['node_modules', '.next'] },
});
