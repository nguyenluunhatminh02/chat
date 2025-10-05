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

  @Get('check/:otherUserId')
  async checkBlockStatus(
    @UserId() userId: string,
    @Param('otherUserId') otherUserId: string,
  ) {
    const blocked = await this.svc.isBlockedEither(userId, otherUserId);

    if (!blocked) {
      return { blocked: false, direction: 'none' };
    }

    // Check who blocked whom
    const iBlockThem = await this.svc.isBlocked(userId, otherUserId);
    const theyBlockMe = await this.svc.isBlocked(otherUserId, userId);

    if (iBlockThem && theyBlockMe) {
      return { blocked: true, direction: 'mutual' };
    } else if (iBlockThem) {
      return { blocked: true, direction: 'blocker' };
    } else {
      return { blocked: true, direction: 'blocked' };
    }
  }
}
