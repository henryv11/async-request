import { Agent as HttpAgent, ClientRequest, IncomingMessage, OutgoingHttpHeaders, request as httpRequest } from 'http';
import { Agent as HttpsAgent, request as httpsRequest } from 'https';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT'] as const;

function asyncRequest(
  urlString: string,
  { agent, headers = {}, method = 'GET', path: basePath = '', query = {}, timeout }: AsyncRequestOptions = {},
) {
  const url = new URL(basePath, urlString);
  Object.entries(query).forEach(([key, value]) =>
    Array.isArray(value)
      ? value.forEach(value => url.searchParams.append(key, String(value)))
      : url.searchParams.append(key, String(value)),
  );
  const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
    method,
    headers,
    agent,
    timeout,
  });
  const res = Object.assign(
    new Promise<AsyncIncomingMessage>((resolve, reject) => {
      req.once('response', res =>
        resolve(
          Object.assign(res, {
            json: <T>() => readBody(res).then(buf => <T>JSON.parse(buf.toString('utf-8'))),
            text: () => readBody(res).then(buf => buf.toString('utf-8')),
            buffer: () => readBody(res),
          }),
        ),
      );
      req.once('error', reject);
      req.once('abort', () => reject(new Error('request aborted')));
      req.once('timeout', () => reject(new Error('request timed out')));
    }),
    {
      json: <T>() => res.then(res => res.json<T>()),
      text: () => res.then(res => res.text()),
      buffer: () => res.then(res => res.buffer()),
    },
  );
  const end = req.end.bind(req);
  return <AsyncClientRequest>Object.assign(req, {
    then: res.then.bind(res),
    catch: res.catch.bind(res),
    finally: res.finally.bind(res),
    end() {
      // eslint-disable-next-line prefer-rest-params
      end(...arguments);
      return res;
    },
  });
}

export default Object.assign(
  asyncRequest,
  METHODS.reduce((methodShorthands, method: Method) => {
    methodShorthands[<Lowercase<Method>>method.toLowerCase()] = (url, options) =>
      asyncRequest(url, { method, ...options });
    return methodShorthands;
  }, <Record<Lowercase<Method>, (url: string, options?: Omit<AsyncRequestOptions, 'method'>) => AsyncClientRequest>>{}),
);

async function readBody(res: IncomingMessage) {
  const buffer: Uint8Array[] = [];
  for await (const chunk of res) {
    buffer.push(chunk);
  }
  return Buffer.concat(buffer);
}

type Method = typeof METHODS[number];

interface ConsumeBodyMethods {
  json: <T>() => Promise<T>;
  text: () => Promise<string>;
  buffer: () => Promise<Buffer>;
}

interface AsyncIncomingMessage extends IncomingMessage, ConsumeBodyMethods {}

interface AsyncRequestOptions {
  agent?: HttpAgent | HttpsAgent | boolean;
  headers?: OutgoingHttpHeaders;
  method?: Method;
  path?: string;
  query?: Record<string, string | number | (string | number)[]>;
  timeout?: number;
}

type AsyncClientRequest = Omit<ClientRequest, 'end'> &
  Promise<AsyncIncomingMessage> & {
    end(cb?: () => void): Promise<AsyncIncomingMessage> & ConsumeBodyMethods;
    end(data: string | Uint8Array, cb?: () => void): Promise<AsyncIncomingMessage> & ConsumeBodyMethods;
    end(str: string, encoding?: BufferEncoding, cb?: () => void): Promise<AsyncIncomingMessage> & ConsumeBodyMethods;
  };
