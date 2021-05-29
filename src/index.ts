import http from 'http';
import https from 'https';
import { pipeline } from 'stream';

const parserByContentType = {
  'application/json': JSON.parse,
};

const driverByProtocol = {
  'https:': https.request,
  'http:': http.request,
};

export default function request<T = unknown>({
  agent,
  body,
  encoding = 'utf-8',
  headers = {},
  json,
  method = 'GET',
  query = {},
  readableStream,
  timeout = 30000,
  url,
  writableStream,
}: {
  agent?: http.Agent | https.Agent | boolean;
  body?: unknown;
  encoding?: BufferEncoding;
  headers?: http.OutgoingHttpHeaders;
  json?: unknown;
  method?: string;
  query?: Record<string, string | number | (string | number)[]>;
  readableStream?: NodeJS.ReadableStream;
  timeout?: number;
  url: string;
  writableStream?: NodeJS.WritableStream;
}) {
  const { protocol, host, port, pathname: path, searchParams: baseSearchParams } = new URL(url);
  const driver = driverByProtocol[<keyof typeof driverByProtocol>protocol];
  const searchParams = new URLSearchParams(baseSearchParams);
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
  return new Promise<typeof response>((resolve, reject) => {
    if (json) {
      body = JSON.stringify(json);
      headers['content-type'] = 'application/json';
      headers['content-length'] = (<string>body).length;
    }
    const req = driver({ host, port, path, method, headers, searchParams, agent }, res => {
      response.code = res.statusCode || -1;
      response.message = res.statusMessage || '';
      response.headers = res.headers;
      res.setEncoding(encoding).on('error', error => {
        res.destroy(error);
        reject(error);
      });
      if (writableStream) {
        return pipeline(res, writableStream, error => {
          if (error) {
            res.destroy(error);
            return reject(error);
          }
          resolve(response);
        });
      }
      const contentType = res.headers['content-type']?.split(';')[0];
      const parser = <(val: unknown) => T>(
        (contentType && contentType in parserByContentType
          ? parserByContentType[<keyof typeof parserByContentType>contentType]
          : _ => _)
      );
      res
        .on('data', data => {
          response.body += data;
        })
        .on('end', () => {
          try {
            response.body = parser(response.body);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
    })
      .setTimeout(timeout)
      .on('timeout', () => reject(new Error('request timed out')))
      .on('error', error => {
        req.destroy(error);
        reject(error);
      });
    if (readableStream) {
      return pipeline(readableStream, req, error => {
        if (error) {
          req.destroy(error);
          return reject(error);
        }
        req.end();
      });
    }
    if (body) {
      req.write(body, encoding, err => err && reject(err));
    }
    req.end();
  });
}
