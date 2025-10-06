import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReadsService } from './reads.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('reads')
export class ReadsController {
  constructor(private svc: ReadsService) {}

  // Mark đã đọc tới
  @Post('conversations/:conversationId/mark')
  mark(
    @UserId() userId: string,
    @Param('conversationId') cid: string,
    @Body() body: { messageId?: string; at?: string },
  ) {
    return this.svc.markReadUpTo(userId, cid, body);
  }

  // Unread của 1 conversation
  @Get('conversations/:conversationId/unread-count')
  unread(
    @UserId() userId: string,
    @Param('conversationId') cid: string,
    @Query('includeSelf') includeSelf?: string,
  ) {
    return this.svc.unreadCount(
      userId,
      cid,
      includeSelf === '1' || includeSelf === 'true',
    );
  }

  // Tổng hợp unread cho tất cả room
  @Get('summary')
  summary(@UserId() userId: string) {
    return this.svc.unreadSummary(userId);
  }

  // Ai đã đọc message này
  @Get('messages/:messageId/readers')
  readers(@Param('messageId') mid: string) {
    return this.svc.readers(mid);
  }
}
