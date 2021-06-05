import { Agent as HttpAgent, ClientRequest, IncomingMessage, OutgoingHttpHeaders, request as httpRequest } from 'http';
import { Agent as HttpsAgent, request as httpsRequest } from 'https';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT'] as const;

function asyncRequest(
  urlString: string,
  { agent, headers = {}, method = 'GET', path: basePath = '', query = {} }: AsyncRequestOptions = {},
): AsyncClientRequest {
  const url = new URL(basePath, urlString);
  Object.entries(query).forEach(([key, value]) =>
    Array.isArray(value)
      ? value.forEach(value => url.searchParams.append(key, String(value)))
      : url.searchParams.append(key, String(value)),
  );
  const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
    method,
    headers,
    agent,
  });
  const responsePromise = new Promise<AsyncIncomingMessage>((resolve, reject) => {
    request.once('response', response =>
      resolve(
        Object.assign(response, {
          json: <T>() => collectResponseBody(response).then(buffer => <T>JSON.parse(buffer.toString('utf-8'))),
          text: () => collectResponseBody(response).then(buffer => buffer.toString('utf-8')),
          buffer: () => collectResponseBody(response),
        }),
      ),
    );
    request.once('error', reject);
    request.once('abort', () => reject(new Error('request aborted')));
    request.once('timeout', () => reject(new Error('request timed out')));
  });
  const endRequest = request.end.bind(request);
  return Object.assign(Object.setPrototypeOf(request, mergedPrototype), {
    then: responsePromise.then.bind(responsePromise),
    catch: responsePromise.catch.bind(responsePromise),
    finally: responsePromise.finally.bind(responsePromise),
    end() {
      // eslint-disable-next-line prefer-rest-params
      endRequest(...arguments);
      return new Promise((resolve, reject) => {
        request.once('error', reject);
        request.once('finish', () => resolve(responsePromise));
      });
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

async function collectResponseBody(res: IncomingMessage) {
  const buffer: Uint8Array[] = [];
  for await (const chunk of res) {
    buffer.push(chunk);
  }
  return Buffer.concat(buffer);
}

const mergedPrototype = Object.assign(ClientRequest.prototype, Promise.prototype);

type Method = typeof METHODS[number];

interface AsyncIncomingMessage extends IncomingMessage {
  json: <T>() => Promise<T>;
  text: () => Promise<string>;
  buffer: () => Promise<Buffer>;
}

interface AsyncRequestOptions {
  agent?: HttpAgent | HttpsAgent | boolean;
  headers?: OutgoingHttpHeaders;
  method?: Method;
  path?: string;
  query?: Record<string, string | number | (string | number)[]>;
}

type AsyncClientRequest = Omit<ClientRequest, 'end'> &
  Promise<AsyncIncomingMessage> & {
    end(cb?: () => void): Promise<AsyncIncomingMessage>;
    end(data: string | Uint8Array, cb?: () => void): Promise<AsyncIncomingMessage>;
    end(str: string, encoding?: BufferEncoding, cb?: () => void): Promise<AsyncIncomingMessage>;
  };
