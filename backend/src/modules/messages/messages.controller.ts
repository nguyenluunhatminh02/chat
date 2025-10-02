import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Get(':conversationId')
  list(
    @Param('conversationId') cid: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 30,
  ) {
    return this.svc.list(cid, cursor, Number(limit));
  }

  @Post()
  send(@UserId() userId: string, @Body() dto: SendMessageDto) {
    return this.svc.send(userId, dto);
  }
}
