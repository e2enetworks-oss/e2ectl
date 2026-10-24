export interface DomainNames {
  baseName: string;
  displayName: string;
  isMyAccount: boolean;
  platform: string;
  platformName: string;
  product: string;
}

export function parseDomainName(input: string | undefined): DomainNames;
export function toPascalCase(name: string): string;
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
export function registerPlatformInProgram(
  source: string,
  names: DomainNames
): string;
export function registerInRuntime(
  source: string,
  names: DomainNames,
  options: { addTransportImport: boolean }
): string;
export function registerInTestRuntime(
  source: string,
  names: DomainNames
): string;
export function renderPlatformFiles(names: DomainNames): Record<string, string>;
export function renderProductFiles(names: DomainNames): Record<string, string>;
