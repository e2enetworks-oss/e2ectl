import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';

describe('createProgram', () => {
  it('registers the expected command namespaces', () => {
    const program = createProgram();

    expect(program.name()).toBe(CLI_COMMAND_NAME);
    expect(
      program.commands.map((command: { name(): string }) => command.name())
    ).toEqual(['config', 'node', 'volume', 'vpc', 'ssh-key']);
  });
});
