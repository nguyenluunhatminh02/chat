import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Post,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { TransferService } from './transfer.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceId } from '../../common/decorators/workspace-id.decorator';

@Controller('transfer')
export class TransferController {
  constructor(private svc: TransferService) {}

  // ===== EXPORT =====
  @UseGuards(WorkspaceGuard)
  @Get('export/conversations/:id')
  async exportConversation(
    @Res({ passthrough: false }) res: Response,
    @UserId() userId: string,
    @WorkspaceId() workspaceId: string,
    @Param('id') conversationId: string,
    @Query('format') format?: 'json' | 'ndjson',
    @Query('gzip') gzip?: string,
    @Query('files') files?: 'meta' | 'presigned',
  ) {
    const opts = {
      format: format || 'ndjson',
      gzip: gzip === '1' || gzip === 'true',
      files: files ?? 'meta',
    } as const;
    if (format === 'json') {
      return this.svc.downloadConversationJson(
        res,
        userId,
        conversationId,
        opts,
      );
    }
    return this.svc.streamConversationNdjson(res, userId, conversationId, opts);
  }

  // ===== IMPORT (NDJSON) =====
  @UseGuards(WorkspaceGuard)
  @Post('import')
  async importNdjson(
    @Req() req: Request,
    @UserId() userId: string,
    @WorkspaceId() workspaceId: string,
    @Query('mode') mode?: 'create' | 'merge',
    @Query('conversationId') conversationId?: string,
    @Query('preserveIds') preserveIds?: string,
    @Query('rehydrate') rehydrate?: string,
    @Query('gzip') gzip?: string,
  ) {
    return this.svc.importNdjson(req, userId, workspaceId, {
      mode: mode || 'create',
      conversationId,
      preserveIds: preserveIds === '1' || preserveIds === 'true',
      rehydrate: rehydrate === '1' || rehydrate === 'true',
      gzip: gzip === '1' || gzip === 'true',
    });
  }
}
