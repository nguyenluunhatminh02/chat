import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StarsService {
  constructor(private prisma: PrismaService) {}

  /** Toggle bookmark for user on a message (idempotent) */
  async toggle(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    // Note: Allow bookmarking any visible message (skip member check)
    // Users can bookmark messages they see in public/shared conversations

    const exist = await this.prisma.star.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (exist) {
      await this.prisma.star.delete({
        where: { messageId_userId: { messageId, userId } },
      });
      return { starred: false };
    } else {
      await this.prisma.star.create({ data: { messageId, userId } });
      return { starred: true };
    }
  }

  /** List bookmarks for user (optionally filter by conversation) */
  async list(
    userId: string,
    conversationId?: string,
    cursor?: string,
    limit = 30,
  ) {
    const stars = await this.prisma.star.findMany({
      where: {
        userId,
        ...(conversationId ? { message: { conversationId } } : {}),
        message: { deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { messageId_userId: { messageId: cursor, userId } },
          }
        : {}),
      select: {
        createdAt: true,
        message: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            type: true,
            content: true,
            createdAt: true,
            editedAt: true,
          },
        },
      },
    });
    return stars.map((s) => ({ starredAt: s.createdAt, ...s.message }));
  }

  /** Check if list of messages are starred by user (for UI rendering) */
  async flags(userId: string, messageIds: string[]) {
    if (!messageIds.length) return {};
    const rows = await this.prisma.star.findMany({
      where: { userId, messageId: { in: messageIds } },
      select: { messageId: true },
    });
    return Object.fromEntries(rows.map((r) => [r.messageId, true]));
  }
}
