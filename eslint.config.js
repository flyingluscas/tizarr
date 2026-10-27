import js from '@eslint/js';
import globals from 'globals';

// Web APIs missing from Chromium 63 (Tizen 5.0). esbuild lowers syntax, not APIs.
const UNSUPPORTED_METHODS = [
  'at',
  'flat',
  'flatMap',
  'replaceAll',
  'replaceChildren',
  'allSettled',
  'fromEntries',
];
const UNSUPPORTED_GLOBALS = [
  'AbortController',
  'ResizeObserver',
  'structuredClone',
  'queueMicrotask',
];

export default [
  { ignores: ['dist/', 'dist-dev/', 'docs/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, tizen: 'readonly' } },
    rules: {
      'no-restricted-properties': [
        'error',
        ...UNSUPPORTED_METHODS.map((property) => ({
          property,
          message: 'Not available on Tizen 5.0 (Chromium 63).',
        })),
      ],
      'no-restricted-globals': [
        'error',
        ...UNSUPPORTED_GLOBALS.map((name) => ({
          name,
          message: 'Not available on Tizen 5.0 (Chromium 63).',
        })),
      ],
    },
  },
  {
    files: ['scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
