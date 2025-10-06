import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';

@Controller('previews')
export class LinkPreviewController {
  constructor(private svc: LinkPreviewService) {}

  @Post('fetch')
  async fetch(@Body() body: { urls: string[] }) {
    const urls = Array.isArray(body?.urls) ? body.urls.slice(0, 10) : [];
    const results: any[] = [];
    for (const u of urls) {
      results.push(await this.svc.fetch(u));
    }
    return results;
  }

  @Get('by-message/:id')
  async byMessage(@Param('id') id: string) {
    return this.svc.previewsForMessage(id);
  }
}
