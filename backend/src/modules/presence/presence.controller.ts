import { Controller, Get, Param, Post } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('presence')
export class PresenceController {
  constructor(
    private presence: PresenceService,
    private prisma: PrismaService,
  ) {}

  @Get(':userId')
  async get(@Param('userId') userId: string) {
    const online = await this.presence.isOnline(userId);
    const lastSeen = await this.presence.lastSeen(userId);
    return { userId, online, lastSeen };
  }

  // Client gọi định kỳ 30–45s
  @Post('heartbeat')
  async beat(@UserId() userId: string) {
    await this.presence.heartbeat(userId);
    return { ok: true, userId, ttlSec: 60 };
  }

  // ===== NEW: ai đang gõ trong 1 conversation
  @Get('typing/:conversationId')
  async typing(@Param('conversationId') cid: string) {
    const typing = await this.presence.getTyping(cid);
    return { conversationId: cid, typing };
  }

  // ===== NEW: online/offline members của 1 conversation
  @Get('conversation/:conversationId')
  async convoPresence(@Param('conversationId') cid: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: cid },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    const checks = await Promise.all(
      ids.map((id) => this.presence.isOnline(id)),
    );
    const online = ids.filter((id, i) => checks[i]);
    const offline = ids.filter((id, i) => !checks[i]);
    return {
      conversationId: cid,
      counts: { total: ids.length, online: online.length },
      online,
      offline,
    };
  }
}
