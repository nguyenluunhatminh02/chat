import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchService } from './search.service';

type MsgPayload = { messageId: string; conversationId?: string };

@Processor('outbox')
@Injectable()
export class SearchIndexProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {
    super();
  }

  async process(job: Job<MsgPayload>): Promise<void> {
    switch (job.name) {
      case 'messaging.message_created':
      case 'messaging.message_updated':
        await this.index(job.data.messageId);
        return;
      case 'messaging.message_deleted':
        await this.search.removeMessage(job.data.messageId).catch(() => {});
        return;
      default:
        return;
    }
  }

  private async index(messageId: string) {
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
    const content = this.extractContent(m.type as string, m.content);
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

  private extractContent(type: string, raw: string | null) {
    if (type === 'TEXT') return raw || '';
    try {
      const v = JSON.parse(raw || '{}');
      return [v?.caption, v?.filename, v?.alt].filter(Boolean).join(' ') || '';
    } catch {
      return '';
    }
  }
}
