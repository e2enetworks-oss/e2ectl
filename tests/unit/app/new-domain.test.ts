import { readFileSync } from 'node:fs';

import {
  insertAfterLastImport,
  insertAfterLastLine,
  insertBeforeLine,
  parseDomainName,
  registerInPlatformIndex,
  registerInRuntime,
  registerInTestRuntime,
  renderProductFiles
} from '../../../scripts/helpers/new-domain.mjs';

const RUNTIME_SOURCE = `import { a } from './a.js';
import {
  b,
  type B
} from './b.js';

export interface CliRuntime {
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  credentialValidator: CredentialValidator;
}

export function createRuntime(): CliRuntime {
  return {
    createNodeClient: (credentials) => new NodeApiClient(credentials),
    credentialValidator: new ApiCredentialValidator(apiClientOptions),
  };
}
`;

describe('parseDomainName', () => {
  it('keeps short names for MyAccount products', () => {
    expect(parseDomainName('myaccount/ssh-key')).toMatchObject({
      baseName: 'SshKey',
      credentialsResolver: 'resolveStoredCredentials',
      credentialsType: 'ResolvedCredentials',
      optionsHelper: 'addContextOptions',
      platform: 'myaccount',
      platformName: 'MyAccount',
      product: 'ssh-key'
    });
  });

  it('adds the platform name for other platforms so names never clash', () => {
    expect(parseDomainName('tir/ssh-key').baseName).toBe('TirSshKey');
  });

  it.each([
    undefined,
    '',
    'foo',
    'tir/',
    'tir/Foo',
    'tir/foo/bar',
    'tir/foo_bar'
  ])('rejects %j', (input) => {
    expect(() => parseDomainName(input)).toThrow(
      'Expected <platform>/<product>'
    );
  });
});

describe('reserved names', () => {
  it('refuses "help" as a product name', () => {
    expect(() => parseDomainName('tir/help')).toThrow('is the help command');
  });

  it.each(['app/foo', 'config/foo', 'core/foo', 'newplatform/foo'])(
    'refuses %s: only myaccount and tir products can be made',
    (input) => {
      expect(() => parseDomainName(input)).toThrow(
        'is not a platform the generator knows. Use myaccount or tir.'
      );
    }
  );
});

describe('text insertion', () => {
  it('adds a line after a multi-line last import', () => {
    expect(
      insertAfterLastImport(RUNTIME_SOURCE, 'import { c } from "./c.js";')
    ).toContain('} from \'./b.js\';\nimport { c } from "./c.js";\n');
  });

  it('fails when the anchor is missing or appears twice', () => {
    expect(() => insertBeforeLine('one\ntwo\n', 'three', 'x')).toThrow(
      'Could not find "three".'
    );
    expect(() => insertBeforeLine('one\none\n', 'one', 'x')).toThrow(
      'Found "one" more than once.'
    );
    expect(() => insertAfterLastLine('one\n', 'three', 'x')).toThrow(
      'Could not find "three".'
    );
  });
});

describe('registering a product', () => {
  it('adds a TIR factory and its import to the runtime', () => {
    const result = registerInRuntime(
      RUNTIME_SOURCE,
      parseDomainName('tir/foo')
    );

    expect(result).toContain(
      "  TirFooApiClient,\n  type TirFooClient\n} from '../tir/foo/index.js';"
    );
    expect(result).toContain(
      '  createTirFooClient(credentials: ResolvedTirCredentials): TirFooClient;\n  credentialValidator: CredentialValidator;'
    );
    expect(result).toContain(
      '    createTirFooClient: (credentials) =>\n      new TirFooApiClient(\n        createTirTransport(credentials, tirApiClientOptions)\n      ),\n    credentialValidator: new ApiCredentialValidator('
    );
  });

  it('gives MyAccount products project credentials and no new transport import', () => {
    const result = registerInRuntime(
      RUNTIME_SOURCE,
      parseDomainName('myaccount/eos')
    );

    expect(result).toContain(
      'createEosClient(credentials: ResolvedCredentials): EosClient;'
    );
    expect(result).toContain(
      'new EosApiClient(\n        createMyAccountTransport(credentials, apiClientOptions)'
    );
    expect(result).not.toContain('myaccount/api.js');
  });

  it('adds the product to the test runtime', () => {
    const source =
      "    createVpcClient: unexpectedClient('VPC'),\n    credentialValidator: { validate: vi.fn() },\n";

    expect(registerInTestRuntime(source, parseDomainName('tir/foo'))).toBe(
      "    createVpcClient: unexpectedClient('VPC'),\n    createTirFooClient: unexpectedClient('TirFoo'),\n    credentialValidator: { validate: vi.fn() },\n"
    );
  });

  it('adds the product to an existing platform command group', () => {
    const source = `import { Command } from 'commander';
import { buildVpcCommand } from './vpc/index.js';

export function buildMyAccountCommand(runtime) {
  command.addCommand(buildNodeCommand(runtime));
  command.addCommand(buildVpcCommand(runtime));

  return command;
}
`;
    const result = registerInPlatformIndex(
      source,
      parseDomainName('myaccount/eos')
    );

    expect(result).toContain(
      "import { buildVpcCommand } from './vpc/index.js';\nimport { buildEosCommand } from './eos/index.js';"
    );
    expect(result).toContain(
      '  command.addCommand(buildVpcCommand(runtime));\n  command.addCommand(buildEosCommand(runtime));'
    );
  });
});

describe('renderProductFiles', () => {
  it('writes the standard product files and a test', () => {
    expect(
      Object.keys(renderProductFiles(parseDomainName('tir/foo'))).sort()
    ).toEqual([
      'src/tir/foo/client.ts',
      'src/tir/foo/command.ts',
      'src/tir/foo/formatter.ts',
      'src/tir/foo/index.ts',
      'src/tir/foo/service.ts',
      'src/tir/foo/types.ts',
      'tests/unit/tir/foo/command.test.ts'
    ]);
  });

  it('gives TIR products the TIR context and never the MyAccount one', () => {
    const files = renderProductFiles(parseDomainName('tir/foo'));

    expect(files['src/tir/foo/service.ts']).toContain(
      "resolveStoredTirCredentials(\n      this.dependencies.store,\n      options,\n      'project'\n    );"
    );
    expect(files['src/tir/foo/command.ts']).toContain('addTirContextOptions');
    expect(files['src/tir/foo/types.ts']).toContain('accountId?: string;');
    expect(files['tests/unit/tir/foo/command.test.ts']).toContain(
      "tir: { account_id: '1', location: 'Delhi', project_id: '2' }"
    );
  });
});

describe('the files the generator edits', () => {
  // The generator finds its place in these files by matching lines of text.
  // This fails as soon as one of them changes shape, rather than later when
  // someone runs make new-domain.
  function read(relativePath: string): string {
    return readFileSync(relativePath, 'utf8');
  }

  it('still has every line the generator looks for', () => {
    const tirFoo = parseDomainName('tir/foo');
    const myAccountBar = parseDomainName('myaccount/bar');

    expect(registerInRuntime(read('src/app/runtime.ts'), tirFoo)).toContain(
      'createTirFooClient: (credentials) =>'
    );
    expect(
      registerInTestRuntime(read('tests/helpers/runtime.ts'), tirFoo)
    ).toContain("createTirFooClient: unexpectedClient('TirFoo'),");
    expect(registerInPlatformIndex(read('src/tir/index.ts'), tirFoo)).toContain(
      'command.addCommand(buildTirFooCommand(runtime));'
    );
    expect(
      registerInPlatformIndex(read('src/myaccount/index.ts'), myAccountBar)
    ).toContain('command.addCommand(buildBarCommand(runtime));');
  });
});
