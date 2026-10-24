import type {
  ApiEnvelope,
  ApiRequestOptions,
  ApiTransport
} from '../../src/http/index.js';

export interface RecordedCall {
  method: 'DELETE' | 'GET' | 'POST' | 'REQUEST';
  options: unknown;
  path?: string;
}

// A transport that answers every call with the same envelope and records
// what each call sent, so client tests can check paths, queries and bodies.
export function createStubTransport(data: unknown = []): {
  calls: RecordedCall[];
  transport: ApiTransport;
} {
  const calls: RecordedCall[] = [];
  const reply = (): Promise<never> =>
    Promise.resolve({
      code: 200,
      data,
      errors: {},
      message: 'OK'
    } satisfies ApiEnvelope<unknown> as never);
  const transport: ApiTransport = {
    delete: (path: string, options?: unknown) => {
      calls.push({ method: 'DELETE', options, path });
      return reply();
    },
    get: (path: string, options?: unknown) => {
      calls.push({ method: 'GET', options, path });
      return reply();
    },
    post: (path: string, options?: unknown) => {
      calls.push({ method: 'POST', options, path });
      return reply();
    },
    request: (options: ApiRequestOptions<unknown>) => {
      calls.push({ method: 'REQUEST', options });
      return reply();
    }
  };

  return { calls, transport };
}
