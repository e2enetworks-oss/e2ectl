import { buildTable } from '../../../src/core/table.js';

describe('buildTable', () => {
  it('prints plain text with no colour codes', () => {
    const table = buildTable({ head: ['ID', 'Name'] });
    table.push(['1', 'web']);

    // eslint-disable-next-line no-control-regex
    expect(table.toString()).not.toMatch(/\u001b\[/);
    expect(table.toString()).toContain('web');
  });
});
