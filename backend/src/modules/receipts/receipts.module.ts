import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
@Module({
  providers: [ReceiptsService, MessagingGateway, PresenceService],
  controllers: [ReceiptsController],
})
export class ReceiptsModule {}
