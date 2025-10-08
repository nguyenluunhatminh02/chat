import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserPresenceService } from './user-presence.service';

// @UseGuards(JwtAuthGuard)
@Controller('presence')
export class UserPresenceController {
  constructor(private presenceService: UserPresenceService) {}

  @Put('status')
  async updateStatus(
    @Body()
    body: { status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'DO_NOT_DISTURB' },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.updatePresence(userId, body.status);
  }

  @Put('custom-status')
  async updateCustomStatus(
    @Body() body: { customStatus: string },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.updateCustomStatus(userId, body.customStatus);
  }

  @Post('custom-status/clear')
  async clearCustomStatus(@Request() req: any) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.clearCustomStatus(userId);
  }

  @Get('user/:userId')
  async getPresence(@Param('userId') userId: string) {
    return this.presenceService.getPresence(userId);
  }

  @Post('users')
  async getMultiplePresences(@Body() body: { userIds: string[] }) {
    return this.presenceService.getMultiplePresences(body.userIds);
  }

  @Get('workspace/:workspaceId/online')
  async getOnlineUsersInWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.presenceService.getOnlineUsersInWorkspace(workspaceId);
  }

  @Get('conversation/:conversationId/online')
  async getOnlineUsersInConversation(
    @Param('conversationId') conversationId: string,
  ) {
    return this.presenceService.getOnlineUsersInConversation(conversationId);
  }

  @Post('heartbeat')
  async heartbeat(@Request() req: any) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.heartbeat(userId);
  }

  @Post('online')
  async setOnline(@Request() req: any) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.setOnline(userId);
  }

  @Post('offline')
  async setOffline(@Request() req: any) {
    const userId = req.user?.userId || 'system';
    return this.presenceService.setOffline(userId);
  }

  // ===== Typing Indicator =====
  @Post('typing/start')
  async typingStart(
    @Body() body: { conversationId: string },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    await this.presenceService.typingStart(userId, body.conversationId);
    return { success: true };
  }

  @Post('typing/stop')
  async typingStop(
    @Body() body: { conversationId: string },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    await this.presenceService.typingStop(userId, body.conversationId);
    return { success: true };
  }

  @Get('typing/:conversationId')
  async getTyping(@Param('conversationId') conversationId: string) {
    const users = await this.presenceService.getTyping(conversationId);
    return { users };
  }
}
