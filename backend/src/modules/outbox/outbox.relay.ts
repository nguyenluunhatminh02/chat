import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessagingGateway } from '../../websockets/messaging.gateway';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OutboxRelay implements OnModuleInit {
  private log = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private gw: MessagingGateway,
  ) {}

  onModuleInit() {
    // tick mỗi 500ms là đủ cho dev; sau này có thể dùng @nestjs/schedule
    this.timer = setInterval(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      () => this.tick().catch((e) => this.log.error(e)),
      500,
    );
  }

  async tick() {
    // lấy một mớ record chưa publish
    const batch = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    if (batch.length === 0) return;

    for (const ev of batch) {
      try {
        switch (ev.topic) {
          case 'messaging.message_created': {
            const { messageId, conversationId } = ev.payload as any;
            // lấy message đầy đủ để push cho client
            const msg = await this.prisma.message.findUnique({
              where: { id: messageId },
            });
            if (!msg) throw new Error('Message not found for outbox event');
            this.gw.emitToConversation(conversationId, 'message.created', {
              message: msg,
            });
            break;
          }
          // có thể thêm các topic khác ở đây (reaction, receipt, v.v.)
          default:
            // chưa hỗ trợ thì bỏ qua (hoặc log)
            this.log.warn(`Unhandled topic: ${ev.topic}`);
        }

        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: {
            publishedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      } catch (err: any) {
        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: {
            attempts: { increment: 1 },
            lastError: String(err?.message ?? err),
          },
        });
      }
    }
  }
}
