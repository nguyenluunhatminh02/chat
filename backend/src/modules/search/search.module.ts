import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchIndexProcessor } from './search-index.processor';
import { BullModule } from '@nestjs/bullmq';
import { OutboxProcessor } from '../outbox/outbox.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [SearchService, OutboxProcessor],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
