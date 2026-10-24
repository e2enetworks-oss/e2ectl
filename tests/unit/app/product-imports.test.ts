import path from 'node:path';

import { RuleTester } from 'oxlint/plugins-dev';

import { productImportsRule } from '../../../scripts/helpers/product-imports-rule.mjs';

const sourceRoot = '/repo/src';
const options = [{ sourceRoot }];
const ruleTester = new RuleTester({ eslintCompat: true });

ruleTester.run('product-imports', productImportsRule, {
  valid: [
    {
      name: 'another product through its index',
      code: "import { VpcApiClient } from '../vpc/index.js';",
      filename: '/repo/src/myaccount/dbaas/service.ts',
      options
    },
    {
      name: 'a file inside the same product',
      code: "import type { DbaasClient } from '../client.js';",
      filename: '/repo/src/myaccount/dbaas/types/service.ts',
      options
    },
    {
      name: 'shared code outside any product',
      code: "import { CliError } from '../../core/errors.js';",
      filename: '/repo/src/myaccount/dbaas/service.ts',
      options
    },
    {
      name: 'the platform file next to the products',
      code: "import { formatMyAccountCommand } from '../api.js';",
      filename: '/repo/src/myaccount/dbaas/formatter.ts',
      options
    },
    {
      name: 'a product on another platform through its index',
      code: "import type { VpcSummary } from '../../myaccount/vpc/index.js';",
      filename: '/repo/src/tir/instance/service.ts',
      options
    },
    {
      name: 'app code through a product index',
      code: "import { NodeApiClient } from '../myaccount/node/index.js';",
      filename: '/repo/src/app/runtime.ts',
      options
    }
  ],
  invalid: [
    {
      name: 'another product file that is not its index',
      code: "import type { VpcSummary } from '../vpc/types.js';",
      filename: '/repo/src/myaccount/dbaas/mappers.ts',
      options,
      errors: [{ messageId: 'deepImport' }]
    },
    {
      name: 'a deep import from a nested folder',
      code: "import type { VpcClient } from '../../vpc/client.js';",
      filename: '/repo/src/myaccount/dbaas/types/service.ts',
      options,
      errors: [{ messageId: 'deepImport' }]
    },
    {
      name: 'a re-export of another product file',
      code: "export { NodeApiClient } from '../node/client.js';",
      filename: '/repo/src/myaccount/vpc/index.ts',
      options,
      errors: [{ messageId: 'deepImport' }]
    },
    {
      name: 'a source folder given relative to the repo root',
      code: "import type { VpcSummary } from '../vpc/types.js';",
      filename: path.join(process.cwd(), 'src/myaccount/dbaas/mappers.ts'),
      options: [{ sourceRoot: 'src' }],
      errors: [{ messageId: 'deepImport' }]
    },
    {
      name: 'app code reaching inside a product',
      code: "import { NodeApiClient } from '../myaccount/node/client.js';",
      filename: '/repo/src/app/runtime.ts',
      options,
      errors: [{ messageId: 'deepImport' }]
    }
  ]
});
