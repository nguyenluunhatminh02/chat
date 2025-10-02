import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { OutboxProducer } from '../outbox/outbox.producer';

@Module({
  providers: [
    MessagesService,
    MessagingGateway,
    PresenceService,
    OutboxProducer,
  ],
  controllers: [MessagesController],
})
export class MessagesModule {}
