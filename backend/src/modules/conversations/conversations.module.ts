import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { OutboxModule } from '../outbox/outbox.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [OutboxModule, FilesModule],
  providers: [ConversationsService, WorkspacesService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
