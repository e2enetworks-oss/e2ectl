export interface DomainNames {
  baseName: string;
  clientOptions: string;
  contextFields: string[];
  credentialsResolver: string;
  credentialsType: string;
  optionsHelper: string;
  platform: string;
  platformName: string;
  product: string;
  resolverRequirement: string;
  testProfile: string;
}

export function parseDomainName(input: string | undefined): DomainNames;
export function insertAfterLastImport(source: string, text: string): string;
export function insertBeforeLine(
  source: string,
  anchor: string,
  text: string
): string;
export function insertAfterLastLine(
  source: string,
  anchor: string,
  text: string
): string;
export function registerInPlatformIndex(
  source: string,
  names: DomainNames
): string;
export function registerInRuntime(source: string, names: DomainNames): string;
export function registerInTestRuntime(
  source: string,
  names: DomainNames
): string;
export function renderProductFiles(names: DomainNames): Record<string, string>;
