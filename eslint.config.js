import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Layer boundaries enforce the Clean Architecture dependency rule (ADR-001, constitution I).
// Each element type is matched by its path inside apps/api/src; the simulator is a separate
// bounded context that may only depend on `shared` and the public query contracts in it.
const apiLayers = [
  { type: 'shared', pattern: 'apps/api/src/shared/**' },
  { type: 'domain', pattern: 'apps/api/src/booking/domain/**' },
  { type: 'application', pattern: 'apps/api/src/booking/application/**' },
  { type: 'infrastructure', pattern: 'apps/api/src/booking/infrastructure/**' },
  { type: 'presentation', pattern: 'apps/api/src/booking/presentation/**' },
  { type: 'booking-module', pattern: 'apps/api/src/booking/*.ts' },
  { type: 'payment-operator-simulator', pattern: 'apps/api/src/payment-operator-simulator/**' },
  { type: 'cli', pattern: 'apps/api/src/cli/**' },
  { type: 'app', pattern: 'apps/api/src/*.ts' },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'graphify-out/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['apps/web/**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['apps/web/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['apps/api/**/*.ts', '*.js', '*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': apiLayers,
      'boundaries/ignore': ['**/*.spec.ts'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'shared', allow: ['shared'] },
            { from: 'domain', allow: ['shared', 'domain'] },
            { from: 'application', allow: ['shared', 'domain', 'application'] },
            { from: 'infrastructure', allow: ['shared', 'domain', 'application', 'infrastructure'] },
            { from: 'presentation', allow: ['shared', 'domain', 'application', 'presentation'] },
            {
              from: 'booking-module',
              allow: ['shared', 'domain', 'application', 'infrastructure', 'presentation'],
            },
            { from: 'payment-operator-simulator', allow: ['shared', 'payment-operator-simulator'] },
            { from: 'cli', allow: ['app', 'shared', 'infrastructure', 'booking-module'] },
            { from: 'app', allow: ['shared', 'booking-module', 'payment-operator-simulator'] },
          ],
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
);
