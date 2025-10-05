import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { BlocksModule } from '../blocks/blocks.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [BlocksModule, OutboxModule],
  providers: [ModerationService],
  controllers: [ModerationController],
  exports: [ModerationService],
})
export class ModerationModule {}
