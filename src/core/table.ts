import Table, { type TableConstructorOptions } from 'cli-table3';

// Every table in the CLI. No colour codes, so output piped to grep, awk or
// an agent stays plain text.
export function buildTable(options: TableConstructorOptions = {}): Table.Table {
  return new Table({
    ...options,
    style: { border: [], head: [], ...options.style }
  });
}
