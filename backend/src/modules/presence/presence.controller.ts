import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('presence')
export class PresenceController {
  constructor(private presence: PresenceService) {}

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
}
