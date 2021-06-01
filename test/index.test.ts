import request from '../src';
import nock from 'nock';

nock.recorder.rec({ logging: console.log });

describe('node-request', () => {
  // test('works', async () => {
  //   interface ResponseBody {
  //     status: string;
  //     data: {
  //       id: number;
  //       employee_name: string;
  //       employee_salay: number;
  //       employee_age: number;
  //       profile_image: string;
  //     }[];
  //   }
  //   const response = await request<ResponseBody>({
  //     url: 'http://dummy.restapiexample.com/api/v1/employees',
  //   });
  //   expect(response.body.data[0]).toBeDefined();
  // });
  // test('stream response', async () => {
  //   const filePath = __dirname + '/response.txt';
  //   const writableStream = fs.createWriteStream(filePath);
  //   await request({ url: 'http://dummy.restapiexample.com/api/v1/employees', writeStream: writableStream });
  //   expect(fs.existsSync(filePath)).toBe(true);
  //   fs.unlinkSync(filePath);
  // });

  // test('fff', async () => {
  //   const url = 'http://url.com';
  //   nock(url).post('/hello').reply(200, {});

  //   const readStream = fs.createReadStream(__dirname + '/test_file.txt', 'utf-8');

  //   const response = await request(url + '/hello', {
  //     method: 'POST',
  //     body: readStream,
  //   });

  //   console.log(response);
  // });

  test.only('bbb', async () => {
    const url = 'http://test_url.com/';
    const path = '/path';
    nock(url).get(path).reply(200, 'hello');
    const response = await request(url, { path });
    console.log(response.body);
  });
});
