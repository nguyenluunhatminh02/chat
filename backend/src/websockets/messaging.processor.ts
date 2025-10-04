// src/websockets/messaging.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingGateway } from './messaging.gateway';

type CreatedPayload = { messageId: string; conversationId: string };
type BumpPayload = {
  conversationId: string;
  messageId: string;
  excludeUserId?: string;
};

@Processor('outbox')
@Injectable()
export class MessagingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gw: MessagingGateway,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    switch (job.name) {
      case 'messaging.message_created': {
        const { messageId, conversationId } = job.data as CreatedPayload;
        const msg = await this.prisma.message.findUnique({
          where: { id: messageId },
        });
        if (!msg) return;
        this.gw.emitToConversation(conversationId, 'message.created', {
          message: msg,
        });
        return;
      }

      case 'messaging.unread_bump': {
        const { conversationId, messageId, excludeUserId } =
          job.data as BumpPayload;
        const members = await this.prisma.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true },
        });
        const userIds = members
          .map((m) => m.userId)
          .filter((uid) => !excludeUserId || uid !== excludeUserId);

        if (userIds.length) {
          this.gw.emitToUsers(userIds, 'unread.bump', {
            conversationId,
            messageId,
          });
        }
        return;
      }

      default:
        return;
    }
  }
}
