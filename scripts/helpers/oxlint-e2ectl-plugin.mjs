// Registers this repo's own lint rules with oxlint (see .oxlintrc.json).
import { productImportsRule } from './product-imports-rule.mjs';

export default {
  meta: { name: 'e2ectl' },
  rules: { 'product-imports': productImportsRule }
};
