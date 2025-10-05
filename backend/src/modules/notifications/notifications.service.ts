import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { PushService } from '../push/push.service';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private redis: RedisClientType;

  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private push: PushService,
  ) {
    // Initialize Redis for throttling
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.redis.connect().catch((err) => {
      this.logger.error(`Redis connection failed: ${err.message}`);
    });
  }

  /**
   * Check if we should send notification (throttle: 30s per user per conversation)
   */
  private async shouldNotify(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const key = `push:mute:${userId}:${conversationId}`;

    try {
      // Set key with NX (only if not exists) and EX (expire in 30 seconds)
      const result = await this.redis.set(key, '1', { NX: true, EX: 30 });
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Redis throttle check failed: ${error}`);
      return true; // Fail open - send notification if Redis fails
    }
  }

  /**
   * Send push notifications to offline members when a new message is created
   */
  async fanoutNewMessage(conversationId: string, messageId: string) {
    this.logger.log(
      `🔔 Fanout notification: conv=${conversationId}, msg=${messageId}`,
    );

    try {
      // 1. Get message details
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          type: true,
          createdAt: true,
        },
      });

      if (!message) {
        this.logger.warn(`Message ${messageId} not found`);
        return;
      }

      this.logger.log(
        `Message from ${message.senderId}: ${message.content?.substring(0, 50)}`,
      );

      // 2. Get all members of the conversation
      const members = await this.prisma.conversationMember.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      // 3. Get conversation details for notification
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true, title: true },
      });

      // 4. Get sender name
      const sender = await this.prisma.user.findUnique({
        where: { id: message.senderId },
        select: { name: true, email: true },
      });

      const senderName = sender?.name || sender?.email || 'Someone';

      // 5. Filter out sender and get offline members
      const otherMembers = members
        .map((m) => m.userId)
        .filter((id) => id !== message.senderId);

      this.logger.log(`Other members: ${otherMembers.join(', ') || 'none'}`);

      // 6. Send push to each offline member
      for (const userId of otherMembers) {
        // Check if user is online
        const isOnline = await this.presence.isOnline(userId);
        this.logger.log(`User ${userId} online status: ${isOnline}`);

        if (isOnline) {
          this.logger.log(`User ${userId} is online, skipping push`);
          continue;
        }

        // Check throttle
        const should = await this.shouldNotify(userId, conversationId);
        this.logger.log(`User ${userId} throttle check: ${should}`);

        if (!should) {
          this.logger.warn(
            `User ${userId} throttled for conversation ${conversationId}`,
          );
          continue;
        }

        // Prepare notification payload
        const title =
          conversation?.type === 'GROUP'
            ? `${senderName} in ${conversation.title || 'Group'}`
            : `Message from ${senderName}`;

        let body = '';
        if (message.type === 'TEXT' && message.content) {
          body =
            message.content.length > 120
              ? message.content.slice(0, 120) + '...'
              : message.content;
        } else if (message.type === 'IMAGE') {
          body = '📷 Sent an image';
        } else if (message.type === 'FILE') {
          body = '📎 Sent a file';
        } else {
          body = 'Sent a message';
        }

        const payload = {
          title,
          body,
          tag: `chat:${conversationId}`, // Group notifications by conversation
          renotify: false,
          icon: '/icon-192.png', // Optional: add app icon
          badge: '/badge-72.png', // Optional: add badge icon
          data: {
            conversationId,
            messageId: message.id,
            senderId: message.senderId,
            url: `/chat/${conversationId}`,
          },
        };

        // Send push notification
        const result = await this.push.sendToUser(userId, payload);
        this.logger.log(
          `Push notification sent to user ${userId}: ${result.sent} subscriptions`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to fanout notifications: ${error}`);
    }
  }
}
