import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      status: 'ok',
      message: 'Nera Cosmétique API',
      version: 'v1',
      docs: '/api/v1',
    };
  }
}
