import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { MarkReadDto } from './dto/mark-read.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { MessagingGateway } from '../../websockets/messaging.gateway';

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private svc: ReceiptsService,
    private gw: MessagingGateway,
  ) {}

  @Post('read')
  async markRead(@UserId() userId: string, @Body() dto: MarkReadDto) {
    const res = await this.svc.markRead(
      userId,
      dto.conversationId,
      dto.messageId,
    );
    // phát realtime để clients khác cập nhật UI (ai đã đọc)
    this.gw.emitToConversation(dto.conversationId, 'receipt.read', {
      conversationId: dto.conversationId,
      userId,
      messageId: dto.messageId,
      readAt: res.readAt,
    });
    return res;
  }

  // tiện: /receipts/unread/:conversationId (cũng có thể đặt dưới /conversations/:id/unread)
  @Get('unread/:conversationId')
  unread(@UserId() userId: string, @Param('conversationId') cid: string) {
    return this.svc.unreadCount(userId, cid);
  }
}
