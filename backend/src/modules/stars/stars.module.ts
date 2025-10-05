import { Module } from '@nestjs/common';
import { StarsService } from './stars.service';
import { StarsController } from './stars.controller';

@Module({
  providers: [StarsService],
  controllers: [StarsController],
  exports: [StarsService],
})
export class StarsModule {}
