import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const docsRoot = resolve(repoRoot, 'docs');
const ignoredFiles = new Set([resolve(docsRoot, 'docs-split-plan.md')]);

const markdownFiles = [
  resolve(repoRoot, 'README.md'),
  resolve(repoRoot, 'CONTRIBUTING.md'),
  ...collectMarkdownFiles(docsRoot)
].filter(
  (file, index, files) =>
    !ignoredFiles.has(file) && files.indexOf(file) === index
);

const headingCache = new Map();
const failures = [];

for (const file of markdownFiles) {
  const contents = readFileSync(file, 'utf8');

  for (const link of extractMarkdownLinks(contents)) {
    if (shouldSkipTarget(link.target)) {
      continue;
    }

    const { anchor, pathText } = splitTarget(link.target);
    const resolvedPath =
      pathText === ''
        ? file
        : resolve(dirname(file), decodeURIComponent(pathText));

    if (!resolvedPath.startsWith(repoRoot)) {
      failures.push(
        formatFailure(
          file,
          link.line,
          link.target,
          'points outside the repository'
        )
      );
      continue;
    }

    if (!existsSync(resolvedPath)) {
      failures.push(
        formatFailure(file, link.line, link.target, 'target does not exist')
      );
      continue;
    }

    if (anchor === undefined) {
      continue;
    }

    if (extname(resolvedPath).toLowerCase() !== '.md') {
      failures.push(
        formatFailure(
          file,
          link.line,
          link.target,
          'anchor target is not a Markdown file'
        )
      );
      continue;
    }

    const anchors = getAnchorsForFile(resolvedPath);
    if (!anchors.has(anchor)) {
      failures.push(
        formatFailure(file, link.line, link.target, 'anchor was not found')
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Docs check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Docs check passed for ${markdownFiles.length} Markdown files.`);

function collectMarkdownFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function extractMarkdownLinks(contents) {
  const links = [];
  const lines = contents.split(/\r?\n/u);
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const pattern = /\[[^\]]*\]\(([^)]+)\)/gu;
    for (const match of line.matchAll(pattern)) {
      const target = match[1]?.trim();
      if (target === undefined || target === '') {
        continue;
      }

      links.push({
        line: index + 1,
        target: target.replace(/^<|>$/gu, '')
      });
    }
  }

  return links;
}

function shouldSkipTarget(target) {
  return /^(https?:|mailto:|tel:|data:)/u.test(target);
}

function splitTarget(target) {
  if (target.startsWith('#')) {
    return {
      anchor: target.slice(1),
      pathText: ''
    };
  }

  const hashIndex = target.indexOf('#');
  if (hashIndex === -1) {
    return {
      anchor: undefined,
      pathText: target
    };
  }

  return {
    anchor: target.slice(hashIndex + 1),
    pathText: target.slice(0, hashIndex)
  };
}

function getAnchorsForFile(file) {
  const cached = headingCache.get(file);
  if (cached !== undefined) {
    return cached;
  }

  const anchors = new Set();
  const counts = new Map();
  const lines = readFileSync(file, 'utf8').split(/\r?\n/u);
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
    if (match === null) {
      continue;
    }

    const heading = normalizeHeadingText(match[2]);
    const slug = slugifyHeading(heading);
    if (slug === '') {
      continue;
    }

    const currentCount = counts.get(slug) ?? 0;
    counts.set(slug, currentCount + 1);
    anchors.add(currentCount === 0 ? slug : `${slug}-${currentCount}`);
  }

  headingCache.set(file, anchors);
  return anchors;
}

function normalizeHeadingText(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/`/gu, '')
    .trim();
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-');
}

function formatFailure(file, line, target, reason) {
  const relativePath = relative(repoRoot, file);
  return `${relativePath}:${line} -> ${target} (${reason})`;
}
