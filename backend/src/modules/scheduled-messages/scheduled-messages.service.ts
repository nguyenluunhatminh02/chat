import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { MessageTypeDto } from '../messages/dto/send-message.dto';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  // số job tối đa xử lý mỗi nhịp cron
  private static readonly BATCH_SIZE = 100;

  // TTL cho job ở trạng thái PROCESSING (ms). Quá thời gian này sẽ requeue lại về PENDING
  private static readonly PROCESSING_TTL_MS = 10 * 60 * 1000; // 10 phút

  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
  ) {}

  /**
   * Tạo lịch gửi tin nhắn
   */
  async scheduleMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
    scheduledFor: Date;
    metadata?: any;
  }) {
    if (data.scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Kiểm tra thành viên hội thoại
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId: data.senderId,
        },
      },
    });
    if (!member) {
      throw new ForbiddenException('User is not a member of this conversation');
    }

    // Tạo bản ghi
    const scheduled = await this.prisma.scheduledMessage.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        scheduledFor: data.scheduledFor,
        metadata: data.metadata ?? {},
        // status mặc định PENDING (đã set trong schema)
      },
    });

    return scheduled;
  }

  /**
   * Lấy các message đã lên lịch của user
   */
  async getUserScheduledMessages(userId: string) {
    return await this.prisma.scheduledMessage.findMany({
      where: { senderId: userId, status: 'PENDING' },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Lấy các message đã lên lịch trong 1 hội thoại (của chính user)
   */
  async getConversationScheduledMessages(
    conversationId: string,
    userId: string,
  ) {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException('Unauthorized');
    }

    return this.prisma.scheduledMessage.findMany({
      where: {
        conversationId,
        senderId: userId,
        status: 'PENDING',
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Huỷ 1 scheduled message
   */
  async cancelScheduledMessage(id: string, userId: string) {
    const scheduled = await this.prisma.scheduledMessage.findUnique({
      where: { id },
    });
    if (!scheduled) {
      throw new BadRequestException('Scheduled message not found');
    }
    if (scheduled.senderId !== userId) {
      throw new ForbiddenException('Unauthorized');
    }
    if (scheduled.status !== 'PENDING') {
      throw new BadRequestException(
        'Cannot cancel message that is not pending',
      );
    }

    return this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Cập nhật scheduled message
   */
  async updateScheduledMessage(
    id: string,
    userId: string,
    data: {
      content?: string;
      scheduledFor?: Date;
      metadata?: any;
    },
  ) {
    const scheduled = await this.prisma.scheduledMessage.findUnique({
      where: { id },
    });
    if (!scheduled) {
      throw new BadRequestException('Scheduled message not found');
    }
    if (scheduled.senderId !== userId) {
      throw new ForbiddenException('Unauthorized');
    }
    if (scheduled.status !== 'PENDING') {
      throw new BadRequestException(
        'Cannot update message that is not pending',
      );
    }
    if (data.scheduledFor && data.scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    return this.prisma.scheduledMessage.update({
      where: { id },
      data: {
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.scheduledFor ? { scheduledFor: data.scheduledFor } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      },
    });
  }

  /**
   * Cron: chạy mỗi phút để xử lý các scheduled messages đến hạn
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledMessages() {
    const now = new Date();

    // 1) Requeue các job đang PROCESSING quá lâu (worker chết/treo)
    const expiredProcessingAt = new Date(
      now.getTime() - ScheduledMessagesService.PROCESSING_TTL_MS,
    );
    const requeued = await this.prisma.scheduledMessage.updateMany({
      where: {
        status: 'PROCESSING',
        processingAt: { lte: expiredProcessingAt },
      },
      data: {
        status: 'PENDING',
        processingAt: null,
        // giữ nguyên failReason (nếu có) hoặc set null tuỳ ý; ở đây giữ nguyên để dễ debug
      },
    });
    if (requeued.count > 0) {
      this.logger.warn(
        `Requeued ${requeued.count} stuck PROCESSING job(s) back to PENDING`,
      );
    }

    // 2) Lấy danh sách ứng viên đến hạn (PENDING & scheduledFor <= now)
    const candidates = await this.prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: ScheduledMessagesService.BATCH_SIZE,
    });
    if (candidates.length === 0) return;

    for (const job of candidates) {
      // 3) Claim "lock mềm" bằng updateMany (so sánh điều kiện)
      const claim = await this.prisma.scheduledMessage.updateMany({
        where: {
          id: job.id,
          status: 'PENDING',
          scheduledFor: { lte: now },
        },
        data: {
          status: 'PROCESSING',
          processingAt: new Date(),
          failReason: null, // clear reason cũ nếu có
        },
      });

      // Nếu claim thất bại => job đã bị instance khác claim, bỏ qua
      if (claim.count === 0) continue;

      // 4) Tiến hành gửi tin nhắn
      try {
        const sent = await this.messages.send(job.senderId, {
          conversationId: job.conversationId,
          type: MessageTypeDto.TEXT,
          content: job.content,
          metadata: (job.metadata as Record<string, any>) ?? undefined,
        });

        // 5) Đánh dấu SENT
        await this.prisma.scheduledMessage.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            sentMessageId: sent.id,
            processingAt: null,
          },
        });

        this.logger.log(
          `Sent scheduled message ${job.id} -> messageId=${sent.id}`,
        );
      } catch (err) {
        // 6) Đánh dấu FAILED (có kèm lý do)
        const reason =
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : 'Unknown error';
        await this.prisma.scheduledMessage.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            processingAt: null,
            failReason: reason.slice(0, 1000), // tránh quá dài
          },
        });

        this.logger.error(
          `Failed to send scheduled message ${job.id}: ${reason}`,
        );
      }
    }
  }
}
