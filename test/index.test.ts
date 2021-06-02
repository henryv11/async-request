import nock from 'nock';
import asyncRequest, { jsonCollector } from '../src';
import fs from 'fs';

describe('async-request', () => {
  test('stream collector', async () => {
    const req = asyncRequest('https://jsonplaceholder.typicode.com/todos');
    req.end();
    const res = await req;
    const collector = jsonCollector<unknown[]>();
    res.pipe(collector);
    const data = await collector;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(1);
  });

  test('json', async () => {
    const url = 'http://test-url/';
    const expectedValue = { hello: 'there', bitch: ['tits'], nested: { value: true } };
    nock(url).get('/').reply(200, expectedValue);
    const req = asyncRequest(url);
    req.end();
    const res = await req;
    expect(await res.json()).toEqual(expectedValue);
  });

  test('stream from file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    const readStream = fs.createReadStream(filePath);
    nock(url)
      .get('/')
      .reply(200, (_, body) => body);
    const req = asyncRequest(url);
    readStream.pipe(req);
    const res = await req;
    expect(await res.text()).toEqual(fs.readFileSync(filePath, 'utf-8'));
  });

  test('stream to file', async () => {
    const url = 'http://test-url/';
    const filePath = __dirname + '/test_file.txt';
    const tempFilePath = __dirname + '/test_file_temp.txt';
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    nock(url).get('/').reply(200, fileContent);
    const req = asyncRequest(url);
    req.end();
    const res = await req;
    const writeStream = fs.createWriteStream(tempFilePath);
    res.pipe(writeStream);
    await new Promise(resolve => writeStream.on('finish', resolve));
    expect(fs.existsSync(tempFilePath)).toEqual(true);
    expect(fs.readFileSync(tempFilePath, 'utf-8')).toEqual(fileContent);
    fs.unlinkSync(tempFilePath);
  });
});
