# Async Request

Utility for making requests in NodeJS using the internal HTTP / HTTPS library.

## Basic request

```ts
// returns AsyncClientRequest & Promise<AsyncIncomingMessage>
const req = request('https://sample-url.com');

// calling .end() will end the request and return Promise<AsyncIncomingMessage>
// without calling .end(), the Promise<AsyncIncomingMessage> will never resolve
const res = await req.end();

// Only one of these can be used at a time to consume the response body
const buffer = await res.buffer(); // reads response body to Buffer
const text = await res.text(); // res.buffer() + Buffer.toString('utf-8')
const json = await res.json(); // res.buffer() + Buffer.toString('utf-8') + JSON.parse
```

## Shorthands

```ts
await request.get('https://sample-url.com').end();
await request.post('https://sample-url.com').end();
await request.put('https://sample-url.com').end();
await request.delete('https://sample-url.com').end();
await request.options('https://sample-url.com').end();
await request.head('https://sample-url.com').end();
await request.connect('https://sample-url.com').end();
```

## Sending data

```ts
const body = JSON.stringify({});
const res = await request
  .post('https://sample-url.com', {
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    },
  })
  .end(body);
```

## Streaming data from file to request

```ts
// NOTICE: .end() is not called, as piping to readStream calls it automatically
const req = request('https://sample-url.com');
fs.createReadStream('path/to/file.ext').pipe(req);
const res = await req;
```

### With async pipeline

⚠️ **WARNING!** Does not work on windows

```ts
const asyncPipeline = promisify(pipeline);
const req = request('https://sample-url.com');
await asyncPipeline(fs.createReadStream('path/to/file.ext'), req);
const res = await req;
```

## Streaming data from response to file

```ts
const asyncPipeline = promisify(pipeline);
const res = await request('https://sample-url.com');
await asyncPipeline(res, fs.createWriteStream('path/to/file.ext'));
```

### Could also be done with just res.pipe, just not as elegant

```ts
const res = await request('https://sample-url.com').end();
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
  },
);
```
