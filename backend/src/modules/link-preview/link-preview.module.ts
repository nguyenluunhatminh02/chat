import { Module } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreviewController } from './link-preview.controller';

@Module({
  providers: [LinkPreviewService],
  controllers: [LinkPreviewController],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}
