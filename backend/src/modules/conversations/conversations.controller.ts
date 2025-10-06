import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { WorkspaceId } from '../../common/decorators/workspace-id.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('conversations')
@UseGuards(WorkspaceGuard)
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Post()
  create(
    @UserId() userId: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.svc.create(userId, dto, workspaceId);
  }

  @Get()
  list(@UserId() userId: string, @WorkspaceId() workspaceId: string) {
    return this.svc.listForUser(userId, workspaceId);
  }
}
