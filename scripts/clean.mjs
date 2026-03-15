import { rmSync } from 'node:fs';

const targets = process.argv.slice(2);

for (const target of targets.length > 0
  ? targets
  : ['dist', 'coverage', '.tmp']) {
  rmSync(target, { force: true, recursive: true });
}
