import { Agent as HttpAgent, ClientRequest, IncomingMessage, OutgoingHttpHeaders, request as httpRequest } from 'http';
import { Agent as HttpsAgent, request as httpsRequest } from 'https';

export default function asyncRequest(url: string, options?: AsyncRequestOptions): Promise<AsyncIncomingMessage>;
export default function asyncRequest(
  url: string,
  options: AsyncRequestOptions | undefined,
  isImmediate: false,
): Promise<AsyncIncomingMessage> & ClientRequest;
export default function asyncRequest(
  url: string,
  { agent, headers = {}, method = 'GET', path: basePath = '', query = {} }: AsyncRequestOptions = {},
  isImmediate = true,
) {
  const { protocol, host, port, pathname: path, searchParams } = new URL(basePath, url);
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(value => searchParams.append(key, String(value)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  const req = (protocol === 'https:' ? httpsRequest : httpRequest)({
    host,
    port,
    path,
    method,
    headers,
    searchParams,
    agent,
  });
  const promise = new Promise<AsyncIncomingMessage>((resolve, reject) => {
    req.once('response', response =>
      resolve(
        Object.assign(response, {
          json: <T>() => collectResponseBody(response).then(buffer => <T>JSON.parse(buffer.toString('utf-8'))),
          text: () => collectResponseBody(response).then(buffer => buffer.toString('utf-8')),
          buffer: () => collectResponseBody(response),
        }),
      ),
    );
    req.once('error', reject);
    req.once('abort', () => reject(new Error('request aborted')));
    req.once('timeout', () => reject(new Error('request timed out')));
  });
  if (isImmediate) {
    req.end();
    return promise;
  }
  return assignPromise(req, promise);
}

async function collectResponseBody(res: IncomingMessage) {
  const buffer: Uint8Array[] = [];
  for await (const chunk of res) {
    buffer.push(chunk);
  }
  return Buffer.concat(buffer);
}

function assignPromise<T, P extends Promise<V extends infer U ? U : V>, V = unknown>(dest: T, promise: P) {
  Object.setPrototypeOf(dest, Object.assign(Object.getPrototypeOf(dest), Promise.prototype));
  (<T & P>dest).then = promise.then.bind(promise);
  (<T & P>dest).catch = promise.catch.bind(promise);
  (<T & P>dest).finally = promise.finally.bind(promise);
  return <T & P>dest;
}

interface AsyncIncomingMessage extends IncomingMessage {
  json: <T>() => Promise<T>;
  text: () => Promise<string>;
  buffer: () => Promise<Buffer>;
}

interface AsyncRequestOptions {
  agent?: HttpAgent | HttpsAgent | boolean;
  headers?: OutgoingHttpHeaders;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'CONNECT';
  path?: string;
  query?: Record<string, string | number | (string | number)[]>;
}
