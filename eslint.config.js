import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

import { productImportsRule } from './scripts/helpers/eslint-product-imports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node
      },
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false }
      ]
    }
  },
  {
    files: ['src/**/*.ts'],
    plugins: {
      e2ectl: { rules: { 'product-imports': productImportsRule } }
    },
    rules: {
      complexity: ['error', 15],
      'e2ectl/product-imports': [
        'error',
        { sourceRoot: path.join(__dirname, 'src') }
      ]
    }
  },
  {
    // Product hints must name their platform (`e2ectl myaccount ...`); each
    // platform's api.ts has the helper that adds it. Products are the folders
    // two levels below src, so api.ts itself is not covered.
    files: ['src/*/*/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/metadata.js'],
              importNames: ['formatCliCommand'],
              message:
                'Use your platform helper (for example formatMyAccountCommand from src/myaccount/api.ts) so the hint names the platform.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {
        ...tseslint.configs.disableTypeChecked.languageOptions.parserOptions
      }
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules
    }
  },
  eslintConfigPrettier
);
