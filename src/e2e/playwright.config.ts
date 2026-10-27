import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../docs/design/DESIGN-MANIFEST.json'), 'utf8'),
) as { responsiveViewports: { name: string; width: number; height: number }[] };

export const viewports = manifest.responsiveViewports;

// Mỗi viewport trong DESIGN-MANIFEST.json là một project.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  projects: viewports.map((v) => ({
    name: v.name,
    use: { viewport: { width: v.width, height: v.height } },
  })),
});
