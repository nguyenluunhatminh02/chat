import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('blocks')
export class BlocksController {
  constructor(private svc: BlocksService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.svc.list(userId);
  }

  @Post()
  block(
    @UserId() userId: string,
    @Body() body: { blockedUserId: string; expiresAt?: string },
  ) {
    return this.svc.block(
      userId,
      body.blockedUserId,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  @Delete(':blockedUserId')
  unblock(
    @UserId() userId: string,
    @Param('blockedUserId') blockedUserId: string,
  ) {
    return this.svc.unblock(userId, blockedUserId);
  }
}
