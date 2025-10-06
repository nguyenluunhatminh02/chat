import { Module } from '@nestjs/common';
import { ReadsService } from './reads.service';
import { ReadsController } from './reads.controller';
import { OutboxProducer } from '../outbox/outbox.producer';

@Module({
  providers: [ReadsService, OutboxProducer],
  controllers: [ReadsController],
  exports: [ReadsService],
})
export class ReadsModule {}
