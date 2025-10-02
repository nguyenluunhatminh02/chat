import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  get() {
    return {
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      time: new Date().toISOString(),
    };
  }
}
