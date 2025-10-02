import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('conversations')
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateConversationDto) {
    return this.svc.create(userId, dto);
  }

  @Get()
  list(@UserId() userId: string) {
    return this.svc.listForUser(userId);
  }
}
