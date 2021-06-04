import { Agent as HttpAgent, ClientRequest, IncomingMessage, OutgoingHttpHeaders, request as httpRequest } from 'http';
import { Agent as HttpsAgent, request as httpsRequest } from 'https';

export default function asyncRequest(
  url: string,
  { agent, headers = {}, method = 'GET', path: basePath = '', query = {} }: AsyncRequestOptions = {},
): AsyncClientRequest {
  const { protocol, host, port, pathname: path, searchParams } = new URL(basePath, url);
  Object.entries(query).forEach(([key, value]) =>
    Array.isArray(value)
      ? value.forEach(value => searchParams.append(key, String(value)))
      : searchParams.append(key, String(value)),
  );
  const req = (protocol === 'https:' ? httpsRequest : httpRequest)({
    host,
    port,
    path,
    method,
    headers,
    searchParams,
    agent,
  });
  const responsePromise = new Promise<AsyncIncomingMessage>((resolve, reject) => {
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
  const endRequest = req.end.bind(req);
  return Object.assign(Object.setPrototypeOf(req, mergedPrototype), {
    then: responsePromise.then.bind(responsePromise),
    catch: responsePromise.catch.bind(responsePromise),
    finally: responsePromise.finally.bind(responsePromise),
    end() {
      console.log(arguments);
      let cb = () => void 0;
      let data = '';
      let encoding: BufferEncoding = 'utf-8';
      if (arguments.length) {
        if (typeof arguments[0] === 'function') {
          [cb] = arguments;
        } else if (typeof arguments[0] === 'string') {
          [data, cb = () => void 0] = arguments;
        } else if (typeof arguments[2] === 'function') {
          [data, encoding, cb = () => void 0] = arguments;
        }
      }
      return new Promise(resolve => endRequest(data, encoding, () => (resolve(responsePromise), cb())));
    },
  });
}

async function collectResponseBody(res: IncomingMessage) {
  const buffer: Uint8Array[] = [];
  for await (const chunk of res) {
    buffer.push(chunk);
  }
  return Buffer.concat(buffer);
}

const mergedPrototype = Object.assign(ClientRequest.prototype, Promise.prototype);

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

type AsyncClientRequest = Omit<ClientRequest, 'end'> &
  Promise<AsyncIncomingMessage> & {
    end: (
      arg1?: (() => void) | string | Uint8Array,
      arg2?: (() => void) | BufferEncoding,
      arg3?: () => void,
    ) => Promise<AsyncIncomingMessage>;
  };
