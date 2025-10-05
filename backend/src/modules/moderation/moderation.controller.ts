import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('moderation')
export class ModerationController {
  constructor(private svc: ModerationService) {}

  // ========== REPORTS ==========

  // User report
  @Post('reports')
  report(
    @UserId() userId: string,
    @Body()
    body: {
      type: 'MESSAGE' | 'USER' | 'CONVERSATION';
      targetMessageId?: string;
      targetUserId?: string;
      targetConversationId?: string;
      reason: 'SPAM' | 'ABUSE' | 'NSFW' | 'HARASSMENT' | 'OTHER';
      details?: string;
    },
  ) {
    return this.svc.report(userId, body);
  }

  // Admin list reports
  @UseGuards(AdminGuard)
  @Get('reports')
  listReports(@Query('status') status?: 'OPEN' | 'RESOLVED' | 'REJECTED') {
    return this.svc.listReports(status);
  }

  // Admin resolve report
  @UseGuards(AdminGuard)
  @Post('reports/:id/resolve')
  resolveReport(
    @Param('id') id: string,
    @UserId() adminId: string,
    @Body()
    body: {
      action?: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER';
      resolutionNotes?: string;
    },
  ) {
    return this.svc.resolve(id, adminId, body);
  }

  // ========== GROUP MODERATION ==========

  // Kick member
  @Post('conversations/:conversationId/kick')
  kickMember(
    @Param('conversationId') conversationId: string,
    @UserId() userId: string,
    @Body() body: { userId: string },
  ) {
    return this.svc.kickMember(conversationId, body.userId, userId);
  }

  // Ban member
  @Post('conversations/:conversationId/ban')
  banMember(
    @Param('conversationId') conversationId: string,
    @UserId() userId: string,
    @Body()
    body: {
      userId: string;
      reason?: string;
      expiresAt?: string;
    },
  ) {
    return this.svc.banMember(
      conversationId,
      body.userId,
      userId,
      body.reason,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  // Unban member
  @Delete('conversations/:conversationId/ban/:userId')
  unbanMember(
    @Param('conversationId') conversationId: string,
    @Param('userId') targetUserId: string,
    @UserId() userId: string,
  ) {
    return this.svc.unbanMember(conversationId, targetUserId, userId);
  }

  // List bans
  @Get('conversations/:conversationId/bans')
  listBans(@Param('conversationId') conversationId: string) {
    return this.svc.listBans(conversationId);
  }

  // ========== APPEALS ==========

  // User create appeal
  @Post('appeals')
  createAppeal(
    @UserId() userId: string,
    @Body()
    body: {
      reportId?: string;
      banId?: string;
      reason: string;
    },
  ) {
    return this.svc.createAppeal(userId, body);
  }

  // Admin list appeals
  @UseGuards(AdminGuard)
  @Get('appeals')
  listAppeals(@Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.svc.listAppeals(status);
  }

  // Admin review appeal
  @UseGuards(AdminGuard)
  @Post('appeals/:id/review')
  reviewAppeal(
    @Param('id') id: string,
    @UserId() adminId: string,
    @Body()
    body: {
      decision: 'APPROVED' | 'REJECTED';
      reviewNotes?: string;
    },
  ) {
    return this.svc.reviewAppeal(id, adminId, body.decision, body.reviewNotes);
  }
}
