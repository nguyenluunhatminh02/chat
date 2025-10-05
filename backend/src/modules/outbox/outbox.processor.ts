// src/outbox/outbox.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { SearchService } from 'src/modules/search/search.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

@Processor('outbox')
@Injectable()
export class OutboxProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private gw: MessagingGateway,
    private search: SearchService,
    private notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    switch (job.name) {
      case 'messaging.message_created': {
        const { messageId, conversationId } = job.data;
        const msg = await this.prisma.message.findUnique({
          where: { id: messageId },
        });
        if (!msg) return;

        // 1) realtime
        this.gw.emitToConversation(conversationId, 'message.created', {
          message: msg,
        });

        // 2) search
        await this.indexMessage(msg.id);

        // 3) push notifications to offline members
        await this.notifications.fanoutNewMessage(conversationId, messageId);

        return;
      }
      case 'messaging.message_updated':
        await this.indexMessage(job.data.messageId);
        return;
      case 'messaging.message_deleted':
        await this.search.removeMessage(job.data.messageId).catch(() => {});
        return;
      case 'messaging.unread_bump': {
        const { conversationId, messageId } = job.data;
        const members = await this.prisma.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true },
        });
        this.gw.emitToUsers(
          members.map((m) => m.userId),
          'unread.bump',
          { conversationId, messageId },
        );
        return;
      }
    }
  }

  private async indexMessage(messageId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        type: true,
        content: true,
        createdAt: true,
        deletedAt: true,
      },
    });
    if (!m || m.deletedAt) {
      await this.search.removeMessage(messageId).catch(() => {});
      return;
    }
    const content =
      m.type === 'TEXT'
        ? m.content || ''
        : (() => {
            try {
              const v = JSON.parse(m.content || '{}');
              return [v?.caption, v?.filename, v?.alt]
                .filter(Boolean)
                .join(' ');
            } catch {
              return '';
            }
          })();
    if (!content.trim()) {
      await this.search.removeMessage(messageId).catch(() => {});
      return;
    }

    await this.search.indexMessage({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type as any,
      content,
      createdAt: m.createdAt.toISOString?.() ?? String(m.createdAt),
    });
  }
}
