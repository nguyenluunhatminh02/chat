import { Controller, Get, Param, Query } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('mentions')
export class MentionsController {
  constructor(private svc: MentionsService) {}

  // Gợi ý ứng viên khi gõ @
  @Get('suggest/:conversationId')
  suggest(
    @Param('conversationId') cid: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.suggest(cid, q, limit ? Number(limit) : 8);
  }

  // Inbox mention của tôi
  @Get('inbox')
  inbox(
    @UserId() userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.inbox(userId, cursor, limit ? Number(limit) : 30);
  }
}
