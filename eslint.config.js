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
    // MyAccount hints must say `e2ectl myaccount ...`; the helper adds it.
    files: ['src/myaccount/**/*.ts'],
    ignores: ['src/myaccount/api.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/metadata.js'],
              importNames: ['formatCliCommand'],
              message:
                'Use formatMyAccountCommand from src/myaccount/api.ts so the hint includes "myaccount".'
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
