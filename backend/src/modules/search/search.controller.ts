import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SearchableMessage, SearchService } from './search.service';

class IndexMessageDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  type!: string; // "TEXT" | ...
  content!: string | null; // nếu null/'' sẽ bị skip theo service
  createdAt!: string; // ISO
}

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  // Index 1 message (demo)
  @Post('index')
  index(@Body() dto: IndexMessageDto) {
    return this.svc.indexMessage(dto as SearchableMessage);
  }

  // Xoá 1 message khỏi index
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.removeMessage(id);
  }

  @Get('messages')
  messages(
    @Query('q') q: string,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? Number(limit) : undefined;
    const off = offset ? Number(offset) : undefined;
    return this.svc.searchMessages(q ?? '', {
      conversationId,
      limit: lim,
      offset: off,
    });
  }
}
