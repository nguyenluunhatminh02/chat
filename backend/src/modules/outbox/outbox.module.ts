import { Module } from '@nestjs/common';
import { OutboxProducer } from './outbox.producer';
import { OutboxProcessor } from './outbox.processor';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { SearchService } from '../search/search.service';
import { BullModule } from '@nestjs/bullmq';
import { OutboxForwarder } from './outbox.forwarder';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { PresenceModule } from '../presence/presence.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'outbox' }),
    NotificationsModule,
    PushModule,
    PresenceModule,
    LinkPreviewModule,
  ],
  providers: [
    OutboxProducer,
    OutboxProcessor,
    MessagingGateway,
    PresenceService,
    SearchService,
    OutboxForwarder,
  ],
  exports: [OutboxProducer],
})
export class OutboxModule {}
