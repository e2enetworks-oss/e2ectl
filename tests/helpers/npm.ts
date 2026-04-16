import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type Platform = NodeJS.Platform;

interface ResolveContext {
  execPath?: string;
  existsSyncFn?: (filePath: string) => boolean;
  pathEnv?: string;
  platform?: Platform;
  realpathSyncFn?: (filePath: string) => string;
}

export function getNpmInvocation(context: ResolveContext = {}): {
  command: string;
  args: string[];
} {
  return {
    command: context.execPath ?? process.execPath,
    args: [resolveNpmCliPath(context)]
  };
}

export function resolveNpmCliPath(context: ResolveContext = {}): string {
  const platform = context.platform ?? process.platform;
  const execPath = context.execPath ?? process.execPath;
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const pathEnv = context.pathEnv ?? process.env.PATH ?? '';
  const hasPath = context.existsSyncFn ?? existsSync;
  const resolvePath = context.realpathSyncFn ?? realpathSync;
  const pathEntries = pathEnv.split(pathApi.delimiter).filter(Boolean);

  if (platform === 'win32') {
    const candidates = [
      pathApi.join(
        pathApi.dirname(execPath),
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js'
      ),
      ...pathEntries.map((entry) =>
        pathApi.join(entry, 'node_modules', 'npm', 'bin', 'npm-cli.js')
      )
    ];

    for (const candidate of candidates) {
      if (hasPath(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      'Unable to locate npm CLI script on Windows for package smoke test.'
    );
  }

  const executableCandidates = [
    ...pathEntries.map((entry) => pathApi.join(entry, 'npm')),
    pathApi.join(
      pathApi.dirname(execPath),
      '..',
      'lib',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    )
  ];

  for (const candidate of executableCandidates) {
    if (hasPath(candidate)) {
      return candidate.endsWith(`${pathApi.sep}npm`)
        ? resolvePath(candidate)
        : candidate;
    }
  }

  throw new Error(
    'Unable to locate npm executable in PATH for package smoke test.'
  );
}
