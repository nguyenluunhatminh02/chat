import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { DraftsService } from './drafts.service';
import { normalizeId } from 'src/common/utils/normalize-id';

@Controller('drafts')
export class DraftsController {
  constructor(private draftsService: DraftsService) {}

  @Post()
  async saveDraft(
    @Body() body: { conversationId: string; content: string; metadata?: any },
    @Request() req: any,
  ) {
    const userId =
      req.user?.userId || (req.headers['x-user-id'] as string) || null;

    if (!userId) throw new UnauthorizedException('Missing X-User-Id');

    return this.draftsService.saveDraft({
      ...body,
      userId: normalizeId(userId),
    });
  }

  @Get('conversation/:conversationId')
  async getDraft(
    @Param('conversationId') conversationId: string,
    @Request() req: any,
  ) {
    const userId =
      req.user?.userId || (req.headers['x-user-id'] as string) || null;
    if (!userId) throw new UnauthorizedException('Missing X-User-Id');
    return this.draftsService.getDraft(conversationId, normalizeId(userId));
  }

  @Get('user')
  async getUserDrafts(@Request() req: any) {
    const userId =
      req.user?.userId || (req.headers['x-user-id'] as string) || null;
    if (!userId) throw new UnauthorizedException('Missing X-User-Id');
    return this.draftsService.getUserDrafts(normalizeId(userId));
  }

  @Delete('conversation/:conversationId')
  async deleteDraft(
    @Param('conversationId') conversationId: string,
    @Request() req: any,
  ) {
    const userId =
      req.user?.userId || (req.headers['x-user-id'] as string) || null;
    if (!userId) throw new UnauthorizedException('Missing X-User-Id');
    return this.draftsService.deleteDraft(conversationId, normalizeId(userId));
  }

  @Delete('user/all')
  async deleteAllUserDrafts(@Request() req: any) {
    const userId =
      req.user?.userId || (req.headers['x-user-id'] as string) || null;
    if (!userId) throw new UnauthorizedException('Missing X-User-Id');
    return this.draftsService.deleteAllUserDrafts(normalizeId(userId));
  }
}
