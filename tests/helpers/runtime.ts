import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { OutputWriter } from '../../src/app/runtime.js';

export class MemoryWriter implements OutputWriter {
  buffer = '';

  write(chunk: string): void {
    this.buffer += chunk;
  }
}

export function createTestConfigPath(prefix: string): string {
  return path.join(process.cwd(), '.tmp', `${prefix}-${randomUUID()}.json`);
}
