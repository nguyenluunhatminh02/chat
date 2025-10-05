import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { PushService, PushSubscription } from './push.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  subscribe(@UserId() userId: string, @Body() subscription: PushSubscription) {
    return this.pushService.subscribe(userId, subscription);
  }

  @Delete('unsubscribe')
  unsubscribe(@Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(body.endpoint);
  }
}
