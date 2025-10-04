import { Module } from '@nestjs/common';
import { OutboxProducer } from './outbox.producer';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { SearchService } from '../search/search.service';
import { BullModule } from '@nestjs/bullmq';
import { OutboxForwarder } from './outbox.forwarder';

@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [
    OutboxProducer,
    MessagingGateway,
    PresenceService,
    SearchService,
    OutboxForwarder,
  ],
  exports: [OutboxProducer],
})
export class OutboxModule {}
