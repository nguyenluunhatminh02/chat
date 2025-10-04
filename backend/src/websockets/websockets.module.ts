// src/websockets/websockets.module.ts
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagingGateway } from './messaging.gateway';
import { MessagingProcessor } from './messaging.processor';
import { PrismaService } from 'src/prisma/prisma.service';
import { PresenceService } from 'src/modules/presence/presence.service';
import { OutboxProcessor } from 'src/modules/outbox/outbox.processor';
import { SearchService } from 'src/modules/search/search.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [
    MessagingGateway,
    OutboxProcessor,
    PrismaService,
    PresenceService,
    SearchService,
  ],
  exports: [MessagingGateway],
})
export class WebsocketsModule {}
