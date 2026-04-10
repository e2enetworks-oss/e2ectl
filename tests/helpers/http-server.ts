import { createServer, type IncomingHttpHeaders } from 'node:http';

export interface RecordedHttpRequest {
  body: string;
  headers: IncomingHttpHeaders;
  method: string;
  pathname: string;
  query: Record<string, string>;
}

export interface HttpRouteResponse {
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
  status?: number;
}

export type HttpRouteHandler = (
  request: RecordedHttpRequest
) => HttpRouteResponse | Promise<HttpRouteResponse>;

export interface TestHttpServer {
  baseUrl: string;
  close(): Promise<void>;
  requests: RecordedHttpRequest[];
}

export async function startTestHttpServer(
  handlers: Record<string, HttpRouteHandler>
): Promise<TestHttpServer> {
  const requests: RecordedHttpRequest[] = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const body = await readRequestBody(request);

    const recordedRequest: RecordedHttpRequest = {
      body,
      headers: request.headers,
      method: request.method ?? 'GET',
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries())
    };
    requests.push(recordedRequest);

    const handler = handlers[routeKey(recordedRequest)];
    const routeResponse: HttpRouteResponse =
      handler === undefined
        ? {
            body: {
              detail: `No handler for ${routeKey(recordedRequest)}`
            },
            status: 404
          }
        : await handler(recordedRequest);
    const payload = routeResponse.body;

    response.statusCode = routeResponse.status ?? 200;
    for (const [key, value] of Object.entries(routeResponse.headers ?? {})) {
      response.setHeader(key, value);
    }

    if (typeof payload === 'string') {
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end(payload);
      return;
    }

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload ?? {}));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test HTTP server did not bind to a TCP address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
            return;
          }

          reject(error);
        });
      });
    },
    requests
  };
}

function routeKey(request: Pick<RecordedHttpRequest, 'method' | 'pathname'>) {
  return `${request.method.toUpperCase()} ${request.pathname}`;
}

async function readRequestBody(
  request: NodeJS.ReadableStream & {
    setEncoding(encoding: BufferEncoding): void;
  }
): Promise<string> {
  return await new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.once('end', () => {
      resolve(body);
    });
    request.once('error', reject);
  });
}
