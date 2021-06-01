import http from 'http';
import https from 'https';
import stream from 'stream';
import path from 'path';

const driverByProtocol = {
  'https:': https.request,
  'http:': http.request,
};

export default function request<T = unknown>(
  url: string,
  {
    agent,
    body,
    encoding = 'utf-8',
    headers = {},
    json,
    method = 'GET',
    path: pathFromOptions = '',
    query = {},
    response: responseParser = _ => <T>(<unknown>_),
    timeout = 30000,
  }: {
    agent?: http.Agent | https.Agent | boolean;
    body?: string | ArrayBuffer | stream.Readable;
    encoding?: BufferEncoding;
    headers?: http.OutgoingHttpHeaders;
    json?: unknown;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'CONNECT';
    path?: string;
    query?: Record<string, string | number | (string | number)[]>;
    response?: (rawBody: string) => T | stream.Writable;
    timeout?: number;
  } = {},
) {
  const {
    protocol,
    host,
    port,
    pathname: pathFromUrl,
    searchParams: searchParamsFromUrl,
  } = new URL(url.startsWith('http') ? url : 'http://' + url);
  const driver = driverByProtocol[<keyof typeof driverByProtocol>protocol];
  const searchParams = new URLSearchParams(searchParamsFromUrl);
  const response = {
    code: -1,
    message: '',
    headers: <http.IncomingHttpHeaders>{},
    body: <T>(<unknown>''),
  };
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(value => searchParams.append(key, String(value)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  headers['accept'] = ['application/json', 'text/*'];
  headers['accept-charset'] = encoding;
  if (json) {
    body = JSON.stringify(json);
    headers['content-type'] = 'application/json;charset=' + encoding;
  }
  return new Promise<typeof response>((resolve, reject) => {
    const req = driver(
      { host, port, path: path.join(pathFromUrl, pathFromOptions), method, headers, searchParams, agent },
      res => {
        function onError(error: Error) {
          res.destroy(error);
          reject(error);
        }
        res.on('error', onError);
        response.code = res.statusCode || -1;
        response.message = res.statusMessage || '';
        response.headers = res.headers;
        if (responseParser instanceof stream.Writable) {
          stream.pipeline(res, responseParser, error => (error ? onError(error) : resolve(response)));
        } else {
          const buffer: Uint8Array[] = [];
          res.on('data', data => {
            buffer.push(data);
          });
          res.on('end', () => {
            try {
              response.body = (<(_: string) => T>responseParser)(Buffer.concat(buffer).toString(encoding));
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
        }
      },
    );
    function onError(error: Error) {
      req.destroy(error);
      reject(error);
    }
    req.setTimeout(timeout);
    req.on('timeout', () => onError(new Error('request timed out after ' + timeout + ' ms')));
    req.on('error', onError);
    if (body) {
      if (body instanceof stream.Readable) {
        stream.pipeline(body, req, error => (error ? onError(error) : req.end()));
      } else {
        if (!req.getHeader('content-length')) {
          req.setHeader('content-length', Buffer.byteLength(body));
        }
        req.write(body, encoding, error => (error ? onError(error) : req.end()));
      }
    } else {
      req.end();
    }
  });
}
