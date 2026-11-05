import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

// Flat config (ESLint 9). This is the old .eslintrc.cjs carried over with the
// same rules — none — rather than an upgrade to eslint:recommended, which would
// turn on rules this codebase has never been held to.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tseslint },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {},
  },
]
