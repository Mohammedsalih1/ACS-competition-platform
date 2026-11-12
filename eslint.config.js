import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `backend/` is a separate Node package with its own tooling. Linting it with
  // this config applied browser globals to server code, so every `process` and
  // `Buffer` reported as no-undef.
  globalIgnores(['dist', 'backend']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/prop-types': 'off',
      'react-hooks/set-state-in-effect': 'off',
      // Shared UI modules intentionally export component variants/hooks.
      'react-refresh/only-export-components': 'off',
    },
  },
])
