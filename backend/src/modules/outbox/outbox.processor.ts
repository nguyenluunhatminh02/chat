// src/outbox/outbox.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { SearchService } from 'src/modules/search/search.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { LinkPreviewService } from 'src/modules/link-preview/link-preview.service';

@Processor('outbox')
@Injectable()
export class OutboxProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private gw: MessagingGateway,
    private search: SearchService,
    private notifications: NotificationsService,
    private linkPreview: LinkPreviewService,
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

        // 4) 👤 mentions: emit mention.created events to mentioned users
        const ments = await this.prisma.mention.findMany({
          where: { messageId },
          select: { userId: true },
        });
        if (ments.length > 0) {
          const snippet = (msg.content ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
          for (const it of ments) {
            this.gw.emitToUser(it.userId, 'mention.created', {
              conversationId,
              messageId,
              senderId: msg.senderId,
              snippet,
            });
          }
        }

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
      case 'pin.added': {
        const { conversationId, messageId } = job.data as {
          conversationId: string;
          messageId: string;
        };
        this.gw.emitToConversation(conversationId, 'pin.added', {
          messageId,
        });
        return;
      }
      case 'pin.removed': {
        const { conversationId, messageId } = job.data as {
          conversationId: string;
          messageId: string;
        };
        this.gw.emitToConversation(conversationId, 'pin.removed', {
          messageId,
        });
        return;
      }
      case 'conversation.read': {
        const { conversationId, userId, at, messageId } = job.data as {
          conversationId: string;
          userId: string;
          at: string;
          messageId?: string | null;
        };
        this.gw.emitToConversation(conversationId, 'conversation.read', {
          conversationId,
          userId,
          at,
          messageId: messageId ?? null,
        });
        return;
      }
      case 'conversation.created': {
        const { conversation, memberIds } = job.data as {
          conversation: any;
          memberIds: string[];
        };
        console.log('🔥 [Outbox] Emitting conversation.created event', {
          conversationId: conversation?.id,
          memberIds,
        });
        // Emit to all members
        this.gw.emitToUsers(memberIds, 'conversation.created', {
          conversation,
          memberIds,
        });
        return;
      }
      case 'preview.request': {
        const { conversationId, messageId, urls } = job.data as {
          conversationId: string;
          messageId: string;
          urls: string[];
        };
        const previews: any[] = [];
        for (const u of urls) {
          previews.push(await this.linkPreview.fetch(u));
        }
        // bắn realtime cho cả room
        this.gw.emitToConversation(conversationId, 'preview.ready', {
          messageId,
          previews,
        });
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
