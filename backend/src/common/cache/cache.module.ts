import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
