import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { CliRuntime, OutputWriter } from '../../src/app/runtime.js';
import { ConfigStore } from '../../src/config/store.js';

export class MemoryWriter implements OutputWriter {
  buffer = '';

  write(chunk: string): void {
    this.buffer += chunk;
  }
}

export function createTestConfigPath(prefix: string): string {
  return path.join(process.cwd(), '.tmp', `${prefix}-${randomUUID()}.json`);
}

// Builds a runtime for command tests. Every client factory throws unless the
// test passes its own, so a command that reaches for the wrong client fails
// loudly. Adding a product adds one line here.
export function createTestRuntime(
  overrides: Partial<CliRuntime> = {}
): CliRuntime {
  return {
    confirm: vi.fn(() => Promise.resolve(false)),
    createDbaasClient: unexpectedClient('DBaaS'),
    createImageClient: unexpectedClient('Image'),
    createLoadBalancerClient: unexpectedClient('Load balancer'),
    createNodeClient: unexpectedClient('Node'),
    createProjectClient: unexpectedClient('Project'),
    createReservedIpClient: unexpectedClient('Reserved IP'),
    createSecurityGroupClient: unexpectedClient('Security group'),
    createSshKeyClient: unexpectedClient('SSH key'),
    createSslClient: unexpectedClient('SSL'),
    createSupportTicketClient: unexpectedClient('Support ticket'),
    createVolumeClient: unexpectedClient('Volume'),
    createVpcClient: unexpectedClient('VPC'),
    createTirAccountClient: unexpectedClient('TirAccount'),
    createTirProjectClient: unexpectedClient('TirProject'),
    createTirImageClient: unexpectedClient('TirImage'),
    createTirPlanClient: unexpectedClient('TirPlan'),
    credentialValidator: { validate: vi.fn() },
    isInteractive: false,
    prompt: vi.fn(() => Promise.resolve('')),
    stderr: new MemoryWriter(),
    stdout: new MemoryWriter(),
    store: new ConfigStore({
      configPath: createTestConfigPath('test-runtime')
    }),
    ...overrides
  };
}

function unexpectedClient(name: string): () => never {
  return vi.fn(() => {
    throw new Error(`${name} client should not be created for this test.`);
  });
}
