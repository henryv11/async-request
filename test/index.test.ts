import fs from 'fs';
import nock from 'nock';
import { pipeline } from 'stream';
import request from '../src';

describe('async-request', () => {
  test('json large', async () => {
    const res = await request('https://jsonplaceholder.typicode.com/todos');
    const data = await res.json<unknown[]>();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(1);
  });

  test('path', async () => {
    const url = 'http://test-url';
    const path = '/hello/there';
    nock(url).get(path).reply(200, 'hello');
    const res = await request(url, { path });
    expect(await res.text()).toEqual('hello');
  });

  test('headers', async () => {
    const url = 'http://test-url';
    const headers = { hello: 'there', there: 'heyhey' };
    nock(url).get('/').matchHeader('hello', headers.hello).matchHeader('there', headers.there).reply(200, 'hello');
    const res = await request(url, { headers });
    expect(await res.text()).toEqual('hello');
  });

  test('json', async () => {
    const url = 'http://test-url/';
    const expectedValue = { hello: 'there', bitch: ['tits'], nested: { value: true } };
    nock(url).get('/').reply(200, expectedValue);
    const res = await request(url);
    expect(await res.json()).toEqual(expectedValue);
  });

  test('stream from file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    nock(url)
      .get('/')
      .reply(200, (_, body) => body);

    const res = await fs.createReadStream(filePath).pipe(request(url, { isImmediate: false }));
    expect(await res.text()).toEqual(fs.readFileSync(filePath, 'utf-8'));
  });

  test('stream to file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    const tempFilePath = __dirname + '/test_file_temp.txt';
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    nock(url).get('/').reply(200, fileContent);
    const res = await request(url);
    await new Promise<void>((resolve, reject) =>
      pipeline(res, fs.createWriteStream(tempFilePath), error => (error ? reject(error) : resolve())),
    );
    expect(fs.existsSync(tempFilePath)).toEqual(true);
    expect(fs.readFileSync(tempFilePath, 'utf-8')).toEqual(fileContent);
    fs.unlinkSync(tempFilePath);
  });
});
