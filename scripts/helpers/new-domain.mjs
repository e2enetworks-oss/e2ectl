// Builds the files and edits for `make new-domain <platform>/<product>`.
// Everything here works on strings so it can be tested without touching
// disk; scripts/new-domain.mjs reads and writes the files.

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// MyAccount's code name is not simply the folder name capitalised
// (createMyAccountTransport, not createMyaccountTransport).
const MYACCOUNT_NAME = 'MyAccount';

// Shared folders under src that must never become a platform.
const RESERVED_PLATFORMS = new Set(['app', 'config', 'core', 'help', 'http']);

// How a product finds its credentials, which context flags its commands
// take, and which address override the runtime hands its transport.
// MyAccount products need a project and location; TIR products need a TIR
// account, project and location; products on a new platform only need a
// key and token until that platform picks its own context.
const PLATFORM_CONTEXT = {
  myaccount: {
    clientOptions: 'apiClientOptions',
    contextFields: ['location', 'projectId'],
    credentialsResolver: 'resolveStoredCredentials',
    credentialsType: 'ResolvedCredentials',
    optionsHelper: 'addContextOptions',
    resolverRequirement: '',
    testProfile: "default_location: 'Delhi',\n    default_project_id: '1'"
  },
  tir: {
    clientOptions: 'tirApiClientOptions',
    contextFields: ['accountId', 'location', 'projectId'],
    credentialsResolver: 'resolveStoredTirCredentials',
    credentialsType: 'ResolvedTirCredentials',
    optionsHelper: 'addTirContextOptions',
    resolverRequirement: ",\n      'project'",
    testProfile: "tir: { account_id: '1', location: 'Delhi', project_id: '2' }"
  }
};

const NEW_PLATFORM_CONTEXT = {
  clientOptions: 'apiClientOptions',
  contextFields: [],
  credentialsResolver: 'resolveStoredAccountCredentials',
  credentialsType: 'ResolvedAccountCredentials',
  optionsHelper: 'addAliasOption',
  resolverRequirement: '',
  testProfile: "default_location: 'Delhi',\n    default_project_id: '1'"
};

export function parseDomainName(input) {
  const parts = (input ?? '').trim().split('/');

  if (
    parts.length !== 2 ||
    !NAME_PATTERN.test(parts[0]) ||
    !NAME_PATTERN.test(parts[1])
  ) {
    throw new Error(
      `Expected <platform>/<product> in lowercase words joined by dashes, for example tir/ssh-key. Got "${input ?? ''}".`
    );
  }

  const [platform, product] = parts;
  if (product === 'help') {
    throw new Error('"help" is the help command, not a product name.');
  }

  if (RESERVED_PLATFORMS.has(platform)) {
    throw new Error(
      `"${platform}" is shared code under src, not a platform. Use a platform such as myaccount or tir.`
    );
  }

  const isMyAccount = platform === 'myaccount';
  const platformName = isMyAccount ? MYACCOUNT_NAME : toPascalCase(platform);
  // MyAccount products keep short names (NodeApiClient). Products on other
  // platforms carry the platform name (TirSshKeyApiClient), so a TIR product
  // can share a name with a MyAccount one without clashing in the runtime.
  const baseName = isMyAccount
    ? toPascalCase(product)
    : `${platformName}${toPascalCase(product)}`;

  return {
    baseName,
    // How people write the platform name in messages, for example TIR.
    displayName: isMyAccount ? MYACCOUNT_NAME : platform.toUpperCase(),
    ...(PLATFORM_CONTEXT[platform] ?? NEW_PLATFORM_CONTEXT),
    platform,
    platformName,
    product
  };
}

function toPascalCase(name) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Inserts `text` on the line after the last import statement.
export function insertAfterLastImport(source, text) {
  // Searching "\n" + source finds an import on the first line too, and the
  // index it returns is already the start of that line in source.
  const start = `\n${source}`.lastIndexOf('\nimport ');

  if (start === -1) {
    throw new Error('No import statement found.');
  }

  const end = source.indexOf(';\n', start);
  if (end === -1) {
    throw new Error('The last import statement does not end with ";".');
  }

  return `${source.slice(0, end + 2)}${text}\n${source.slice(end + 2)}`;
}

// Inserts `text` as a new line straight before the only line that contains
// `anchor`. Fails when the anchor is missing or appears more than once.
export function insertBeforeLine(source, anchor, text) {
  const index = findOnlyOccurrence(source, anchor);
  const lineStart = source.lastIndexOf('\n', index) + 1;

  return `${source.slice(0, lineStart)}${text}\n${source.slice(lineStart)}`;
}

// Inserts `text` as a new line straight after the last line that contains
// `anchor`.
export function insertAfterLastLine(source, anchor, text) {
  const index = source.lastIndexOf(anchor);

  if (index === -1) {
    throw new Error(`Could not find "${anchor.trim()}".`);
  }

  const lineEnd = source.indexOf('\n', index);

  return `${source.slice(0, lineEnd + 1)}${text}\n${source.slice(lineEnd + 1)}`;
}

function findOnlyOccurrence(source, anchor) {
  const index = source.indexOf(anchor);

  if (index === -1) {
    throw new Error(`Could not find "${anchor.trim()}".`);
  }

  if (source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Found "${anchor.trim()}" more than once.`);
  }

  return index;
}

// --- Edits to existing files -------------------------------------------------

export function registerInPlatformIndex(source, names) {
  const withImport = insertAfterLastImport(
    source,
    `import { build${names.baseName}Command } from './${names.product}/index.js';`
  );

  return insertAfterLastLine(
    withImport,
    '  command.addCommand(',
    `  command.addCommand(build${names.baseName}Command(runtime));`
  );
}

export function registerPlatformInProgram(source, names) {
  const withImport = insertAfterLastImport(
    source,
    `import { build${names.platformName}Command } from '../${names.platform}/index.js';`
  );

  return insertAfterLastLine(
    withImport,
    '  program.addCommand(',
    `  program.addCommand(build${names.platformName}Command(runtime));`
  );
}

export function registerInRuntime(source, names, { addTransportImport }) {
  let next = insertAfterLastImport(
    source,
    `import {\n  ${names.baseName}ApiClient,\n  type ${names.baseName}Client\n} from '../${names.platform}/${names.product}/index.js';`
  );

  if (addTransportImport) {
    next = insertAfterLastImport(
      next,
      `import { create${names.platformName}Transport } from '../${names.platform}/api.js';`
    );
  }

  next = insertBeforeLine(
    next,
    '  credentialValidator: CredentialValidator;',
    `  create${names.baseName}Client(credentials: ${names.credentialsType}): ${names.baseName}Client;`
  );

  return insertBeforeLine(
    next,
    '    credentialValidator: new ApiCredentialValidator(',
    `    create${names.baseName}Client: (credentials) =>\n      new ${names.baseName}ApiClient(\n        create${names.platformName}Transport(credentials, ${names.clientOptions})\n      ),`
  );
}

export function registerInTestRuntime(source, names) {
  return insertBeforeLine(
    source,
    '    credentialValidator: { validate: vi.fn() },',
    `    create${names.baseName}Client: unexpectedClient('${names.baseName}'),`
  );
}

// --- New files ---------------------------------------------------------------

// A new platform's index registers its first product straight away.
export function renderPlatformFiles(names) {
  const { displayName, platform, platformName } = names;
  const addressConstant = `${platform.toUpperCase().replaceAll('-', '_')}_API_BASE_URL`;

  return {
    [`src/${platform}/api.ts`]: `import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import {
  HttpTransport,
  type ApiClientCredentials,
  type ApiClientOptions,
  type ApiTransport
} from '../http/index.js';

// Set this to the ${displayName} API address before adding real commands.
// Until then every ${platform} command stops with a clear error instead of
// sending requests somewhere else. options.baseUrl is not used here: the
// runtime fills it from the MyAccount address override.
const ${addressConstant}: string | undefined = undefined;

export function create${platformName}Transport(
  credentials: ApiClientCredentials,
  options: ApiClientOptions = {}
): ApiTransport {
  const baseUrl = ${addressConstant};
  if (baseUrl === undefined) {
    throw new CliError('The ${displayName} API address is not set yet.', {
      code: 'PLATFORM_ADDRESS_MISSING',
      exitCode: EXIT_CODES.config,
      suggestion: 'Set ${addressConstant} in src/${platform}/api.ts.'
    });
  }

  return new HttpTransport(credentials, {
    ...options,
    apiName: '${displayName}',
    baseUrl
  });
}

// Builds a ${platform} command for hints and errors.
export function format${platformName}Command(argumentsText: string): string {
  return formatCliCommand(\`${platform} \${argumentsText}\`);
}
`,
    [`src/${platform}/index.ts`]: `import { Command } from 'commander';

import type { CliRuntime } from '../app/runtime.js';
import { build${names.baseName}Command } from './${names.product}/index.js';

export function build${platformName}Command(runtime: CliRuntime): Command {
  const command = new Command('${platform}').description(
    'Manage E2E ${displayName} resources.'
  );

  command.helpCommand('help [command]', 'Show help for a ${platform} command');

  command.addCommand(build${names.baseName}Command(runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
`
  };
}

export function renderProductFiles(names) {
  const { baseName, contextFields, platform, product } = names;
  const directory = `src/${platform}/${product}`;
  const pathConstant = `${product.toUpperCase().replaceAll('-', '_')}_PATH`;
  const contextOptions = `export interface ${baseName}ContextOptions {
  alias?: string;${contextFields.map((field) => `\n  ${field}?: string;`).join('')}
}`;

  return {
    [`${directory}/types.ts`]: `export interface ${baseName}Item {
  id: number;
  name: string;
}

${contextOptions}

export interface ${baseName}ListCommandResult {
  action: 'list';
  items: ${baseName}Item[];
}

export type ${baseName}CommandResult = ${baseName}ListCommandResult;
`,
    [`${directory}/client.ts`]: `// API quirks: none known yet. List each one here as you find it.
import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { ${baseName}Item } from './types.js';

const ${pathConstant} = '/${product}/';

export interface ${baseName}Client {
  listItems(): Promise<${baseName}Item[]>;
}

export class ${baseName}ApiClient implements ${baseName}Client {
  constructor(private readonly transport: ApiTransport) {}

  async listItems(): Promise<${baseName}Item[]> {
    const response = await this.transport.get<ApiEnvelope<${baseName}Item[]>>(
      ${pathConstant}
    );

    return response.data;
  }
}
`,
    [`${directory}/service.ts`]: renderService(names),
    [`${directory}/formatter.ts`]: `import Table from 'cli-table3';

import { stableStringify } from '../../core/json.js';
import type { ${baseName}CommandResult } from './types.js';

export function render${baseName}Result(
  result: ${baseName}CommandResult,
  json: boolean
): string {
  if (json) {
    return \`\${stableStringify({ action: result.action, items: result.items.map((item) => ({ id: item.id, name: item.name })) })}\\n\`;
  }

  if (result.items.length === 0) {
    return 'No ${product} items found.\\n';
  }

  const table = new Table({ head: ['ID', 'Name'] });
  for (const item of result.items) {
    table.push([String(item.id), item.name]);
  }

  return \`\${table.toString()}\\n\`;
}
`,
    [`${directory}/command.ts`]: `import { Command } from 'commander';

import { ${names.optionsHelper} } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { render${baseName}Result } from './formatter.js';
import { ${baseName}Service } from './service.js';
import type { ${baseName}ContextOptions } from './types.js';

interface GlobalOptions {
  json?: boolean;
}

export function build${baseName}Command(runtime: CliRuntime): Command {
  const service = new ${baseName}Service({
    create${baseName}Client: (credentials) =>
      runtime.create${baseName}Client(credentials),
    store: runtime.store
  });
  const command = new Command('${product}').description(
    'Manage ${platform} ${product} resources.'
  );

  command.helpCommand('help [command]', 'Show help for a ${product} command');

  ${names.optionsHelper}(
    command.command('list').description('List ${product} items.')
  ).action(
    async (options: ${baseName}ContextOptions, commandInstance: Command) => {
      const result = await service.list(options);
      runtime.stdout.write(
        render${baseName}Result(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
`,
    [`${directory}/index.ts`]: `export { build${baseName}Command } from './command.js';
export { ${baseName}ApiClient, type ${baseName}Client } from './client.js';
export type {
  ${baseName}CommandResult,
  ${baseName}ContextOptions,
  ${baseName}Item,
  ${baseName}ListCommandResult
} from './types.js';
`,
    [`tests/unit/${platform}/${product}/command.test.ts`]: renderTest(names)
  };
}

function renderService(names) {
  const {
    baseName,
    credentialsResolver: resolver,
    credentialsType,
    resolverRequirement
  } = names;

  return `import {
  ${resolver},
  type ConfigFile,
  type ${credentialsType}
} from '../../config/index.js';
import type { ${baseName}Client } from './client.js';
import type {
  ${baseName}ContextOptions,
  ${baseName}ListCommandResult
} from './types.js';

interface ${baseName}Store {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface ${baseName}ServiceDependencies {
  create${baseName}Client(credentials: ${credentialsType}): ${baseName}Client;
  store: ${baseName}Store;
}

export class ${baseName}Service {
  constructor(private readonly dependencies: ${baseName}ServiceDependencies) {}

  async list(
    options: ${baseName}ContextOptions
  ): Promise<${baseName}ListCommandResult> {
    const credentials = await ${resolver}(
      this.dependencies.store,
      options${resolverRequirement}
    );
    const client = this.dependencies.create${baseName}Client(credentials);
    const items = await client.listItems();

    return { action: 'list', items };
  }
}
`;
}

function renderTest(names) {
  const { baseName, platform, product } = names;

  return `import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type { ${baseName}Client } from '../../../../src/${platform}/${product}/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

async function run${baseName}List(
  client: ${baseName}Client,
  extraArgs: string[] = []
): Promise<string> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('${platform}-${product}-command-test')
  });
  await store.upsertProfile('default', {
    api_key: 'key',
    auth_token: 'token',
    ${names.testProfile}
  });
  const stdout = new MemoryWriter();
  const program = createProgram(
    createTestRuntime({
      create${baseName}Client: () => client,
      stdout,
      store
    })
  );

  await program.parseAsync([
    'node',
    'e2ectl',
    ...extraArgs,
    '${platform}',
    '${product}',
    'list'
  ]);

  return stdout.buffer;
}

describe('${platform} ${product} commands', () => {
  it('lists items as a table', async () => {
    const output = await run${baseName}List({
      listItems: () => Promise.resolve([{ id: 7, name: 'first' }])
    });

    expect(output).toContain('first');
  });

  it('lists items as JSON', async () => {
    const output = await run${baseName}List(
      { listItems: () => Promise.resolve([{ id: 7, name: 'first' }]) },
      ['--json']
    );

    expect(JSON.parse(output)).toEqual({
      action: 'list',
      items: [{ id: 7, name: 'first' }]
    });
  });

  it('says so when there are no items', async () => {
    const output = await run${baseName}List({
      listItems: () => Promise.resolve([])
    });

    expect(output).toBe('No ${product} items found.\\n');
  });
});
`;
}
