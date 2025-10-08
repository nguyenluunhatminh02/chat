import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class UserPresenceService implements OnModuleInit, OnModuleDestroy {
  private r: RedisClientType;
  private typingTtlSec = 6; // hiển thị "đang gõ" ~ 6s sau mỗi ping

  constructor(private prisma: PrismaService) {
    this.r = createClient({ url: process.env.REDIS_URL });
  }

  async onModuleInit() {
    await this.r.connect();
  }

  async onModuleDestroy() {
    await this.r.quit();
  }

  /**
   * Update user presence status
   */
  async updatePresence(
    userId: string,
    status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'DO_NOT_DISTURB',
    customStatus?: string,
  ) {
    return this.prisma.userPresence.upsert({
      where: { userId },
      create: {
        userId,
        status,
        customStatus,
        lastSeenAt: new Date(),
      },
      update: {
        status,
        customStatus,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Set user online
   */
  async setOnline(userId: string) {
    return this.updatePresence(userId, 'ONLINE');
  }

  /**
   * Set user offline
   */
  async setOffline(userId: string) {
    return this.updatePresence(userId, 'OFFLINE');
  }

  /**
   * Set user away (after inactivity)
   */
  async setAway(userId: string) {
    return this.updatePresence(userId, 'AWAY');
  }

  /**
   * Update custom status
   */
  async updateCustomStatus(userId: string, customStatus: string) {
    const presence = await this.prisma.userPresence.findUnique({
      where: { userId },
    });

    const currentStatus = presence?.status || 'OFFLINE';

    return this.updatePresence(userId, currentStatus, customStatus);
  }

  /**
   * Clear custom status
   */
  async clearCustomStatus(userId: string) {
    return this.prisma.userPresence.update({
      where: { userId },
      data: { customStatus: null },
    });
  }

  /**
   * Get user presence
   */
  async getPresence(userId: string) {
    let presence = await this.prisma.userPresence.findUnique({
      where: { userId },
    });

    if (!presence) {
      // Create default presence if not exists
      presence = await this.prisma.userPresence.create({
        data: {
          userId,
          status: 'OFFLINE',
        },
      });
    }

    return presence;
  }

  /**
   * Get presence for multiple users
   */
  async getMultiplePresences(userIds: string[]) {
    const presences = await this.prisma.userPresence.findMany({
      where: {
        userId: { in: userIds },
      },
    });

    // Create map for quick lookup
    const presenceMap = new Map(presences.map((p) => [p.userId, p]));

    // Return presences in same order as input, with defaults for missing
    return userIds.map((userId) => {
      return (
        presenceMap.get(userId) || {
          userId,
          status: 'OFFLINE',
          customStatus: null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        }
      );
    });
  }

  /**
   * Get online users in a workspace
   */
  async getOnlineUsersInWorkspace(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });

    const userIds = members.map((m) => m.userId);

    const presences = await this.prisma.userPresence.findMany({
      where: {
        userId: { in: userIds },
        status: { in: ['ONLINE', 'AWAY', 'BUSY'] },
      },
    });

    return presences;
  }

  /**
   * Get online users in a conversation
   */
  async getOnlineUsersInConversation(conversationId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const userIds = members.map((m) => m.userId);

    const presences = await this.prisma.userPresence.findMany({
      where: {
        userId: { in: userIds },
        status: { in: ['ONLINE', 'AWAY', 'BUSY'] },
      },
    });

    return presences;
  }

  /**
   * Heartbeat - update last seen
   */
  async heartbeat(userId: string) {
    return this.prisma.userPresence.update({
      where: { userId },
      data: { lastSeenAt: new Date() },
    });
  }

  /**
   * Auto-set users to away if inactive for more than X minutes
   */
  async autoSetAwayUsers(inactiveMinutes: number = 5) {
    const threshold = new Date(Date.now() - inactiveMinutes * 60 * 1000);

    const updated = await this.prisma.userPresence.updateMany({
      where: {
        status: 'ONLINE',
        lastSeenAt: {
          lt: threshold,
        },
      },
      data: {
        status: 'AWAY',
      },
    });

    return updated;
  }

  /**
   * Auto-set users to offline if inactive for more than X minutes
   */
  async autoSetOfflineUsers(inactiveMinutes: number = 30) {
    const threshold = new Date(Date.now() - inactiveMinutes * 60 * 1000);

    const updated = await this.prisma.userPresence.updateMany({
      where: {
        status: { in: ['ONLINE', 'AWAY'] },
        lastSeenAt: {
          lt: threshold,
        },
      },
      data: {
        status: 'OFFLINE',
      },
    });

    return updated;
  }

  // ===== Typing Indicator (from old presence module) =====
  /**
   * User starts typing in a conversation
   */
  async typingStart(userId: string, conversationId: string) {
    const setKey = `typing:conv:${conversationId}`;
    const userKey = `typing:conv:${conversationId}:${userId}`;
    await this.r.sAdd(setKey, userId);
    await this.r.set(userKey, '1', { EX: this.typingTtlSec }); // auto-expire if no ping
  }

  /**
   * User stops typing in a conversation
   */
  async typingStop(userId: string, conversationId: string) {
    const setKey = `typing:conv:${conversationId}`;
    const userKey = `typing:conv:${conversationId}:${userId}`;
    await this.r.del(userKey);
    await this.r.sRem(setKey, userId);
  }

  /**
   * Get list of users currently typing in a conversation
   */
  async getTyping(conversationId: string): Promise<string[]> {
    const setKey = `typing:conv:${conversationId}`;
    const members = await this.r.sMembers(setKey);
    if (!members.length) return [];

    // Filter: only keep users whose TTL key still exists
    const exists = await Promise.all(
      members.map((uid) =>
        this.r.exists(`typing:conv:${conversationId}:${uid}`),
      ),
    );
    const alive = members.filter((_, i) => exists[i] === 1);

    // Cleanup: remove expired users from SET
    const garbage = members.filter((_, i) => exists[i] === 0);
    if (garbage.length) await this.r.sRem(setKey, garbage);

    return alive;
  }
}
