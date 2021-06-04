import fs from 'fs';
import nock from 'nock';
import { pipeline } from 'stream';
import request from '../src';
import { promisify } from 'util';

const asyncPipeline = promisify(pipeline);

describe('async-request', () => {
  test('sending json', async () => {
    const url = 'http://test-url';
    const jsonObject = { hello: 'there' };
    nock(url)
      .get('/')
      .reply(200, (_, body) => body);

    const data = JSON.stringify(jsonObject);
    const res = await request(url, {
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
    }).end(data);
    const json = await res.json();
    expect(json).toEqual(jsonObject);
  });

  test('json large', async () => {
    const res = await request('https://jsonplaceholder.typicode.com/todos').end();
    const data = await res.json<unknown[]>();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(1);
  });

  test('path', async () => {
    const url = 'http://test-url';
    const path = '/hello/there';
    nock(url).get(path).reply(200, 'hello');
    const res = await request(url, { path }).end();
    expect(await res.text()).toBe('hello');
  });

  test('headers', async () => {
    const url = 'http://test-url';
    const headers = { hello: 'there', there: 'heyhey' };
    nock(url).get('/').matchHeader('hello', headers.hello).matchHeader('there', headers.there).reply(200, 'hello');
    const res = await request(url, { headers }).end();
    expect(await res.text()).toBe('hello');
  });

  test('json', async () => {
    const url = 'http://test-url/';
    const expectedValue = { hello: 'there', bitch: ['tits'], nested: { value: true } };
    nock(url).get('/').reply(200, expectedValue);
    const res = await request(url).end();
    expect(await res.json()).toEqual(expectedValue);
  });

  test('stream from file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    nock(url)
      .get('/')
      .reply(200, (_, body) => body);

    const req = request(url);

    // TODO: Does not work on Windows, find out why
    // await asyncPipeline(fs.createReadStream(filePath), req);
    // const res = await req;

    fs.createReadStream(filePath).pipe(req);
    const res = await req;
    expect(await res.text()).toEqual(fs.readFileSync(filePath, 'utf-8'));
  });

  test('stream to file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    const tempFilePath = __dirname + '/test_file_temp.txt';
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    nock(url).get('/').reply(200, fileContent);
    const res = await request(url).end();
    await asyncPipeline(res, fs.createWriteStream(tempFilePath));
    expect(fs.existsSync(tempFilePath)).toBe(true);
    expect(fs.readFileSync(tempFilePath, 'utf-8')).toBe(fileContent);
    fs.unlinkSync(tempFilePath);
  });
});
