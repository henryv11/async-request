import http from 'http';
import https from 'https';
import path from 'path';
import stream from 'stream';

export default function asyncRequest(
  url: string,
  {
    agent,
    headers = {},
    method = 'GET',
    path: pathFromOptions = '',
    query = {},
  }: {
    agent?: http.Agent | https.Agent | boolean;
    headers?: http.OutgoingHttpHeaders;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'CONNECT';
    path?: string;
    query?: Record<string, string | number | (string | number)[]>;
  } = {},
) {
  const { protocol, host, port, pathname: pathFromUrl, searchParams: searchParamsFromUrl } = new URL(url);
  const driver = protocol === 'https:' ? https.request : http.request;
  const searchParams = new URLSearchParams(searchParamsFromUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(value => searchParams.append(key, String(value)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  const req = driver({
    host,
    port,
    path: path.join(pathFromUrl, pathFromOptions),
    method,
    headers,
    searchParams,
    agent,
  });
  return assignPromise(
    req,
    new Promise<http.IncomingMessage & { json: <T>() => Promise<T>; text: () => Promise<string> }>(
      (resolve, reject) => {
        req.once('response', response =>
          resolve(
            Object.assign(response, {
              json: <T>() => readResponseBody(response, buffer => <T>JSON.parse(buffer.toString('utf-8'))),
              text: () => readResponseBody(response, buffer => buffer.toString('utf-8')),
              buffer: () => readResponseBody(response, buffer => buffer),
            }),
          ),
        );
        req.once('error', reject);
        req.once('abort', () => reject(new Error('request aborted')));
        req.once('timeout', () => reject(new Error('request timed out')));
      },
    ),
  );
}

async function readResponseBody<T>(res: http.IncomingMessage, parser: (buffer: Buffer) => T) {
  const collector = collectStream<T>(parser);
  res.pipe(collector);
  return await collector;
}

export function collectToJson<T>() {
  return collectStream<T>(buffer => JSON.parse(buffer.toString('utf-8')));
}

export function collectToText() {
  return collectStream<string>(buffer => buffer.toString('utf-8'));
}

export function collectToBuffer() {
  return collectStream(_ => _);
}

function collectStream<T>(parser: (buffer: Buffer) => T) {
  const buffer: Uint8Array[] = [];
  const writeStream = new stream.Writable({
    write(chunk, _, cb) {
      buffer.push(chunk);
      cb();
    },
  });
  writeStream.end = (cb?: () => void) => writeStream.emit('finish', cb);
  const promise = new Promise<T>((resolve, reject) => {
    writeStream.once('finish', () => {
      resolve(parser(Buffer.concat(buffer)));
    });
    writeStream.once('error', reject);
  });

  return assignPromise(writeStream, promise);
}

function assignPromise<T, P extends Promise<V extends infer U ? U : V>, V = unknown>(dest: T, promise: P) {
  Object.setPrototypeOf(dest, Object.assign(Object.getPrototypeOf(dest), Promise.prototype));
  (<T & P>dest).then = promise.then.bind(promise);
  (<T & P>dest).catch = promise.catch.bind(promise);
  (<T & P>dest).finally = promise.finally.bind(promise);
  return <T & P>dest;
}
