import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchIndexProcessor } from './search-index.processor';
import { BullModule } from '@nestjs/bullmq';
import { OutboxProcessor } from '../outbox/outbox.processor';
import { NotificationsService } from '../notifications/notifications.service';
import { PresenceService } from '../presence/presence.service';
import { PushService } from '../push/push.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [
    SearchService,
    OutboxProcessor,
    NotificationsService,
    PresenceService,
    PushService,
    LinkPreviewService,
  ],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
