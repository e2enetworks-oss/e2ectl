import { createProgram } from '../../../src/app/program.js';

describe('createProgram', () => {
  it('registers the expected command namespaces', () => {
    const program = createProgram();

    expect(program.name()).toBe('e2ectl');
    expect(
      program.commands.map((command: { name(): string }) => command.name())
    ).toEqual(['config', 'node', 'volume', 'vpc', 'ssh-key']);
  });
});
