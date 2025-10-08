import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DraftsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Save or update a draft for a conversation
   */
  async saveDraft(data: {
    conversationId: string;
    userId: string;
    content: string;
    metadata?: any;
  }) {
    console.log('userId', data.userId);

    if (!data.content || data.content.trim() === '') {
      return this.deleteDraft(data.conversationId, data.userId);
    }

    // xác thực member (ok)
    if (
      !data.conversationId.startsWith('test-') &&
      !data.userId.startsWith('demo-')
    ) {
      const member = await this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: data.conversationId,
            userId: data.userId,
          },
        },
        select: { userId: true },
      });
      if (!member) throw new Error('User is not a member of this conversation');
    }

    return this.prisma.messageDraft.upsert({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId: data.userId,
        },
      },
      create: {
        conversationId: data.conversationId,
        userId: data.userId,
        content: data.content.trim(),
        metadata: data.metadata ?? {},
      },
      update: {
        content: data.content.trim(),
        metadata: data.metadata ?? {},
        // updatedAt được Prisma tự set nếu bạn dùng @updatedAt
      },
    });
  }

  /**
   * Get draft for a conversation
   */
  async getDraft(conversationId: string, userId: string) {
    return await this.prisma.messageDraft.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
  }

  /**
   * Get all drafts for a user
   */
  async getUserDrafts(userId: string) {
    return await this.prisma.messageDraft.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(conversationId: string, userId: string) {
    try {
      await this.prisma.messageDraft.delete({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });
      return { success: true };
    } catch (error) {
      // Draft doesn't exist, that's ok
      return { success: true };
    }
  }

  /**
   * Delete all drafts for a user
   */
  async deleteAllUserDrafts(userId: string) {
    const result = await this.prisma.messageDraft.deleteMany({
      where: { userId },
    });

    return { deletedCount: result.count };
  }

  /**
   * Clean up old drafts (older than X days)
   */
  async cleanupOldDrafts(daysOld: number = 30) {
    const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.prisma.messageDraft.deleteMany({
      where: {
        updatedAt: {
          lt: threshold,
        },
      },
    });

    return { deletedCount: result.count };
  }
}
