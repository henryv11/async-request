# Async Request

Utility for making requests in NodeJS using the internal HTTP / HTTPS library.

## Basic request

```ts
// Resolves to http.IncomingMessage
// with some additional utilities to read the response body
const res = await request('https://sample-url.com');

// Only one of these can be used at a time to consume the response body
const buffer = await res.buffer(); // reads response body to Buffer
const text = await res.text(); // res.buffer() + Buffer.toString('utf-8')
const json = await res.json(); // res.buffer() + Buffer.toString('utf-8') + JSON.parse
```

## Sending data

```ts
// Returns http.ClientRequest & Promise<http.IncomingMessage>
const req = request('https://sample-url.com', { isImmediate: false });

// Write to request body
const body = JSON.stringify({});
req.setHeader('content-type', 'application/json');
req.setHeader('content-length', Buffer.byteLength(body));
// req.end has to be called to end the request if isImmediate is set to false
req.write(body, () => req.end());

// await the response
const res = await req;
```

## Streaming data from file to request

```ts
const res = await fs
  .createReadStream('path/to/file.ext')
  .pipe(request('https://sample-url.com', { isImmediate: false }));
```

## Streaming data from response to file

```ts
const res = await request('https://sample-url.com');
await new Promise<void>((resolve, reject) =>
  pipeline(res, fs.createWriteStream('path/to/file.ext'), error => (error ? reject(error) : resolve())),
);
```

### Could also be done with just res.pipe, just not as elegant

```ts
const res = await request('https://sample-url.com');
res.pipe(fs.createWriteStream('path/to/file.ext'));
// Make sure that writing the response body to file is finished
// after following line
await new Promise(resolve => res.once('end', resolve));
```

## Options

```ts
const res = await request(
  // if protocol is https user NodeJS https.request else http.request
  'https://sample-url.com',
  // optional options object
  {
    // basePath, eg path: '/hello/there' => https://sample-url.com/hello/there
    path: '',
    // headers object, will be added to request
    headers: {},
    // override default agent
    agent: new https.Agent(),
    // query object, will be stringified and merged to url
    query: {},
    // request method 'GET' | 'POST' | 'PUT' etc...
    // default 'GET'
    method: 'GET',
    // default true, ends the request immediately
    // and returns the response promise
    // if you want to write data to request
    // set to false, write data, and end the request
    isImmediate: true,
  },
);
```
