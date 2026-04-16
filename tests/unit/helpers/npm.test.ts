import { getNpmInvocation, resolveNpmCliPath } from '../../helpers/npm.js';

describe('npm helper', () => {
  it('resolves npm through PATH on unix-like platforms', () => {
    const resolvedPath = resolveNpmCliPath({
      execPath: '/tool/bin/node',
      existsSyncFn: (filePath) => filePath === '/tool/bin/npm',
      pathEnv: '/tool/bin:/usr/bin',
      platform: 'linux',
      realpathSyncFn: (filePath) => `${filePath}-real`
    });

    expect(resolvedPath).toBe('/tool/bin/npm-real');
  });

  it('resolves npm CLI alongside the node installation on windows', () => {
    const resolvedPath = resolveNpmCliPath({
      execPath: 'C:\\hostedtoolcache\\node\\node.exe',
      existsSyncFn: (filePath) =>
        filePath ===
        'C:\\hostedtoolcache\\node\\node_modules\\npm\\bin\\npm-cli.js',
      pathEnv: 'C:\\hostedtoolcache\\node;C:\\Windows\\System32',
      platform: 'win32'
    });

    expect(resolvedPath).toBe(
      'C:\\hostedtoolcache\\node\\node_modules\\npm\\bin\\npm-cli.js'
    );
  });

  it('returns a node-based invocation', () => {
    const invocation = getNpmInvocation({
      execPath: '/tool/bin/node',
      existsSyncFn: (filePath) => filePath === '/tool/bin/npm',
      pathEnv: '/tool/bin:/usr/bin',
      platform: 'linux',
      realpathSyncFn: (filePath) => `${filePath}-real`
    });

    expect(invocation).toEqual({
      args: ['/tool/bin/npm-real'],
      command: '/tool/bin/node'
    });
  });

  it('throws when npm cannot be located', () => {
    expect(() =>
      resolveNpmCliPath({
        execPath: '/tool/bin/node',
        existsSyncFn: () => false,
        pathEnv: '/tool/bin:/usr/bin',
        platform: 'linux',
        realpathSyncFn: (filePath) => filePath
      })
    ).toThrow(/Unable to locate npm executable/);
  });
});
