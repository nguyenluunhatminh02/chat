import { Module } from '@nestjs/common';
import { PinsService } from './pins.service';
import { PinsController } from './pins.controller';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [OutboxModule],
  providers: [PinsService],
  controllers: [PinsController],
  exports: [PinsService],
})
export class PinsModule {}
