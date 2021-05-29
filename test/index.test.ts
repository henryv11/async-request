import fs from 'fs';
import request from '../src';
describe('node-request', () => {
  test('works', async () => {
    interface ResponseBody {
      status: string;
      data: {
        id: number;
        employee_name: string;
        employee_salay: number;
        employee_age: number;
        profile_image: string;
      }[];
    }
    const response = await request<ResponseBody>({
      url: 'http://dummy.restapiexample.com/api/v1/employees',
    });
    expect(response.body.data[0]).toBeDefined();
  });

  test('stream response', async () => {
    const filePath = __dirname + '/response.txt';
    const writableStream = fs.createWriteStream(filePath);
    await request({ url: 'http://dummy.restapiexample.com/api/v1/employees', writableStream });
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });
});
