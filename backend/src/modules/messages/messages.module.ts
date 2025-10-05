import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { OutboxProducer } from '../outbox/outbox.producer';
import { BlocksModule } from '../blocks/blocks.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [BlocksModule, ModerationModule],
  providers: [
    MessagesService,
    MessagingGateway,
    PresenceService,
    OutboxProducer,
  ],
  controllers: [MessagesController],
})
export class MessagesModule {}
