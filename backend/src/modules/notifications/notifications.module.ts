import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushModule } from '../push/push.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [PushModule, PresenceModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
