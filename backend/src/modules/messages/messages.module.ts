import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';

@Module({
  providers: [MessagesService, MessagingGateway, PresenceService],
  controllers: [MessagesController],
})
export class MessagesModule {}
