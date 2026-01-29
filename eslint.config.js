import globals from 'globals';
import pluginImport from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/**', 'lib/**', 'dist/**', '*.min.js'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.worker,
        THREE: 'readonly',
        OpenCascade: 'readonly',
        oc: 'readonly',
        mocha: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
        chai: 'readonly',
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'always'],
    },
  },
];
