import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.pnpm-store/**',
      '**/.next/**',
      '**/dist/**',
      'docs/**',
      'src/**/.venv/**',
      'data/raw/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
