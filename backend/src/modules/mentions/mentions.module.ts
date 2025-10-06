import { Module } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { MentionsController } from './mentions.controller';

@Module({
  providers: [MentionsService],
  controllers: [MentionsController],
  exports: [MentionsService],
})
export class MentionsModule {}
