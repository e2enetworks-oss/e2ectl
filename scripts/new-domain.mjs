// Creates an empty product: `make new-domain tir/foo` or
// `node scripts/new-domain.mjs tir/foo`. Works out every change before
// writing, so a bad name or a missing place to edit writes nothing; then
// writes the files and formats them.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProcess } from './helpers/process.mjs';
import {
  parseDomainName,
  registerInPlatformIndex,
  registerInRuntime,
  registerInTestRuntime,
  registerPlatformInProgram,
  renderPlatformFiles,
  renderProductFiles
} from './helpers/new-domain.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

async function main() {
  const names = parseDomainName(process.argv[2]);
  const changes = planChanges(names);

  for (const [relativePath, contents] of Object.entries(changes)) {
    const fullPath = path.join(repoRoot, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
  }

  const files = Object.keys(changes);
  const prettier = await runProcess(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/prettier/bin/prettier.cjs'),
      '--write',
      ...files
    ],
    { cwd: repoRoot }
  );
  if (prettier.exitCode !== 0) {
    throw new Error(`Prettier failed:\n${prettier.stderr}`);
  }

  console.log(
    `Created ${names.platform}/${names.product}. Files written or changed:`
  );
  for (const file of files.sort()) {
    console.log(`  ${file}`);
  }
  console.log(
    `Try it: npm run dev -- ${names.platform} ${names.product} --help`
  );
}

function planChanges(names) {
  const productDirectory = `src/${names.platform}/${names.product}`;
  if (existsSync(path.join(repoRoot, productDirectory))) {
    throw new Error(`${productDirectory} already exists.`);
  }

  const existingCommand = findCommandFile(names.platform, names.product);
  if (existingCommand !== undefined) {
    throw new Error(
      `${existingCommand} already defines a "${names.product}" command on ${names.platform}.`
    );
  }

  const runtimeSource = read('src/app/runtime.ts');
  if (runtimeSource.includes(`create${names.baseName}Client`)) {
    throw new Error(
      `src/app/runtime.ts already has create${names.baseName}Client.`
    );
  }

  const isNewPlatform = !existsSync(
    path.join(repoRoot, 'src', names.platform, 'index.ts')
  );
  const changes = {
    ...renderProductFiles(names),
    'src/app/runtime.ts': registerInRuntime(runtimeSource, names, {
      addTransportImport: isNewPlatform
    }),
    'tests/helpers/runtime.ts': registerInTestRuntime(
      read('tests/helpers/runtime.ts'),
      names
    )
  };

  if (isNewPlatform) {
    Object.assign(changes, renderPlatformFiles(names));
    changes['src/app/program.ts'] = registerPlatformInProgram(
      read('src/app/program.ts'),
      names
    );
  } else {
    const indexPath = `src/${names.platform}/index.ts`;
    changes[indexPath] = registerInPlatformIndex(read(indexPath), names);
  }

  return changes;
}

// A product folder's name can differ from its command (load-balancer is
// `lb`), so look for the command itself in the platform's command files.
function findCommandFile(platform, product) {
  const platformDirectory = path.join(repoRoot, 'src', platform);
  if (!existsSync(platformDirectory)) {
    return undefined;
  }

  const marker = `new Command('${product}')`;
  return readdirSync(platformDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('src', platform, entry.name, 'command.ts'))
    .find(
      (file) =>
        existsSync(path.join(repoRoot, file)) && read(file).includes(marker)
    );
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

main().catch((error) => {
  console.error(
    `new-domain: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
