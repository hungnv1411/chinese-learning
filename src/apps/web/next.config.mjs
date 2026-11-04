import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
export default {
  output: 'standalone',
  // Monorepo: theo dõi file từ gốc repo để standalone gom đủ packages/core.
  outputFileTracingRoot: resolve(import.meta.dirname, '../../..'),
  transpilePackages: ['@clp/core'],
  // Trang /nguon-du-lieu đọc content/sources.yaml ở gốc repo lúc chạy.
  outputFileTracingIncludes: { '/nguon-du-lieu': ['../../../content/sources.yaml'] },
};
