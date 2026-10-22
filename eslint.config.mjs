// ESLint (flat config) for the backend. Scope: the Vuelos module, the code all teams share (src/common, main.ts,
// app.module.ts) and the repo scripts. The modules of the other teams (alojamientos, autos, atracciones) are theirs
// and stay out; the frontend has its own config in frontend/.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'frontend/**',
      'graphify-out/**',
      'src/modules/alojamientos/**',
      'src/modules/autos/**',
      'src/modules/atracciones/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The type-aware rules that find real bugs: a promise nobody awaits or catches, or one passed where a callback is expected.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { arguments: false } }],
      '@typescript-eslint/await-thenable': 'error',
      // `import x = require('...')` is the typed TypeScript form (used for supertest, which has no default export without esModuleInterop).
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }],
      // `_name` marks an argument or variable that is unused on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    // Tests stub freely; `any` in a test double is not a production risk.
    files: ['**/*.spec.ts', 'src/modules/vuelos/testing/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
