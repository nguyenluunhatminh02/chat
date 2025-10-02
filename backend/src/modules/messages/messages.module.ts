import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';

@Module({
  providers: [MessagesService, MessagingGateway],
  controllers: [MessagesController],
})
export class MessagesModule {}
