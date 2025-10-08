import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { OutboxProducer } from '../outbox/outbox.producer';
import { BlocksModule } from '../blocks/blocks.module';
import { ModerationModule } from '../moderation/moderation.module';
import { MentionsModule } from '../mentions/mentions.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    BlocksModule,
    ModerationModule,
    MentionsModule,
    LinkPreviewModule,
    FilesModule,
  ],
  providers: [
    MessagesService,
    MessagingGateway,
    PresenceService,
    OutboxProducer,
  ],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
