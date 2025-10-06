import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [OutboxModule],
  providers: [ConversationsService, WorkspacesService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
