import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

// A product is a folder two levels below src, such as src/myaccount/node.
// Code outside a product may use it only through the product's index.ts, so
// each product can change its other files without breaking its neighbours.
export const productImportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Products import each other only through the other product index.ts.'
    },
    messages: {
      deepImport:
        'Import {{product}} through its index.js, not "{{specifier}}".'
    },
    schema: [
      {
        type: 'object',
        properties: { sourceRoot: { type: 'string' } },
        required: ['sourceRoot'],
        additionalProperties: false
      }
    ]
  },
  create(context) {
    // sourceRoot is relative to the repo root, found from this file's own
    // place (scripts/helpers), so the rule works the same whichever folder
    // lint or an editor starts from.
    const sourceRoot = path.resolve(REPO_ROOT, context.options[0].sourceRoot);
    const filename = context.filename;
    const ownProduct = findProduct(sourceRoot, filename);

    function check(node) {
      const specifier = node.source?.value;
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
        return;
      }

      const target = path.resolve(path.dirname(filename), specifier);
      const targetProduct = findProduct(sourceRoot, target);
      if (targetProduct === undefined || targetProduct === ownProduct) {
        return;
      }

      if (isProductIndex(sourceRoot, targetProduct, target)) {
        return;
      }

      context.report({
        node: node.source,
        messageId: 'deepImport',
        data: { product: targetProduct, specifier }
      });
    }

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check
    };
  }
};

// Shared code under src, never a platform (matches the generator's list).
const SHARED_FOLDERS = new Set(['app', 'config', 'core', 'http']);

// Returns "platform/product" for a path inside a product folder.
function findProduct(sourceRoot, filePath) {
  const parts = path.relative(sourceRoot, filePath).split(path.sep);

  if (parts.length < 3 || parts[0] === '..' || SHARED_FOLDERS.has(parts[0])) {
    return undefined;
  }

  return `${parts[0]}/${parts[1]}`;
}

function isProductIndex(sourceRoot, product, target) {
  const indexPath = path.join(sourceRoot, product, 'index');

  return target.replace(/\.(js|ts)$/, '') === indexPath;
}
