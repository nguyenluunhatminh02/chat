import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StarsService } from './stars.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('stars')
export class StarsController {
  constructor(private svc: StarsService) {}

  @Post('toggle')
  toggle(@UserId() userId: string, @Body() body: { messageId: string }) {
    return this.svc.toggle(userId, body.messageId);
  }

  @Get()
  list(
    @UserId() userId: string,
    @Query('conversationId') conversationId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(
      userId,
      conversationId,
      cursor,
      limit ? Number(limit) : 30,
    );
  }

  @Post('flags')
  flags(@UserId() userId: string, @Body() body: { messageIds: string[] }) {
    return this.svc.flags(userId, body.messageIds ?? []);
  }
}
