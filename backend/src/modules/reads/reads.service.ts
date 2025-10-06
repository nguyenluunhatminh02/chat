import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxProducer } from '../outbox/outbox.producer';

@Injectable()
export class ReadsService {
  constructor(
    private prisma: PrismaService,
    private outbox: OutboxProducer,
  ) {}

  /** Bảo đảm user là member của conversation nếu họ đã thuộc workspace của conversation */
  private async ensureMember(conversationId: string, userId: string) {
    // Đã là member?
    const existing = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { userId: true, lastReadAt: true },
    });
    if (existing) return existing;

    // Lấy workspace của conversation
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!convo) throw new NotFoundException('Conversation not found');

    // Chỉ auto-join nếu user thuộc workspace
    const wsMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: convo.workspaceId, userId } },
      select: { userId: true },
    });
    if (!wsMember) {
      // Không cho auto-join nếu không thuộc workspace
      throw new ForbiddenException('Not a member');
    }

    // Auto-join với role MEMBER (idempotent nhờ @@unique([conversationId, userId]))
    await this.prisma.conversationMember.create({
      data: { conversationId, userId, role: 'MEMBER' },
    });

    // Trả về mốc đọc rỗng
    return { userId, lastReadAt: null as Date | null };
  }

  /** Mark đã đọc tới messageId hoặc tới thời điểm 'at' (ISO). Trả về { newReadAt, messageId? } */
  async markReadUpTo(
    userId: string,
    conversationId: string,
    opts: { messageId?: string; at?: string },
  ) {
    if (!opts.messageId && !opts.at) {
      throw new BadRequestException('Require messageId or at');
    }

    // ✔ đổi sang ensureMember - cho phép auto-join nếu user thuộc workspace
    const member = await this.ensureMember(conversationId, userId);

    // Xác định mốc
    let upToAt: Date;
    let upToMessageId: string | undefined;

    if (opts.messageId) {
      const msg = await this.prisma.message.findUnique({
        where: { id: opts.messageId },
        select: {
          id: true,
          conversationId: true,
          createdAt: true,
          deletedAt: true,
        },
      });
      if (!msg || msg.deletedAt || msg.conversationId !== conversationId) {
        throw new NotFoundException('Message not found in conversation');
      }
      upToAt = msg.createdAt;
      upToMessageId = msg.id;
    } else {
      const t = new Date(opts.at!);
      if (isNaN(+t)) throw new BadRequestException('Invalid "at"');
      upToAt = t;
    }

    const newReadAt =
      member.lastReadAt && member.lastReadAt > upToAt
        ? member.lastReadAt
        : upToAt;

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: newReadAt },
    });

    if (upToMessageId) {
      await this.prisma.readReceipt.upsert({
        where: { messageId_userId: { messageId: upToMessageId, userId } },
        create: { messageId: upToMessageId, userId },
        update: { readAt: new Date() },
      });
    }

    await this.outbox.emit('conversation.read', {
      conversationId,
      userId,
      at: newReadAt.toISOString(),
      messageId: upToMessageId ?? null,
    });

    return { conversationId, newReadAt, messageId: upToMessageId };
  }

  /** Đếm số tin chưa đọc (mặc định: chỉ tính tin của người khác) */
  async unreadCount(
    userId: string,
    conversationId: string,
    includeSelf = false,
  ) {
    // ❗️Chỗ bạn bị 403 —> thay vì findUnique + Forbidden, dùng ensureMember:
    const member = await this.ensureMember(conversationId, userId);

    const where: any = { conversationId, deletedAt: null };
    if (member.lastReadAt) where.createdAt = { gt: member.lastReadAt };
    if (!includeSelf) where.senderId = { not: userId };

    const count = await this.prisma.message.count({ where });
    return { conversationId, count, lastReadAt: member.lastReadAt ?? null };
  }

  /** Trả readers của một message: hợp nhất ReadReceipt (nếu có) + suy luận từ lastReadAt */
  async readers(messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        createdAt: true,
        senderId: true,
        deletedAt: true,
      },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: msg.conversationId },
      select: { userId: true, lastReadAt: true },
    });

    const receipts = await this.prisma.readReceipt.findMany({
      where: { messageId: msg.id },
      select: { userId: true, readAt: true },
    });
    const explicit = new Map(receipts.map((r) => [r.userId, r.readAt]));

    const readers = members
      .filter((m) => m.userId !== msg.senderId)
      .map((m) => {
        const exp = explicit.get(m.userId);
        const inferred = !exp && m.lastReadAt && m.lastReadAt >= msg.createdAt;
        const readAt = exp ?? (inferred ? m.lastReadAt! : null);
        return readAt ? { userId: m.userId, readAt, inferred: !exp } : null;
      })
      .filter(Boolean) as Array<{
      userId: string;
      readAt: Date;
      inferred: boolean;
    }>;

    return {
      messageId: msg.id,
      readers: readers.sort((a, b) => +a.readAt - +b.readAt),
    };
  }

  /** Tổng hợp unread cho tất cả hội thoại của user */
  async unreadSummary(userId: string) {
    const cms = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });

    const results = await Promise.all(
      cms.map(async (cm) => {
        const where: any = {
          conversationId: cm.conversationId,
          deletedAt: null,
          senderId: { not: userId },
        };
        if (cm.lastReadAt) where.createdAt = { gt: cm.lastReadAt };
        const count = await this.prisma.message.count({ where });
        return {
          conversationId: cm.conversationId,
          count,
          lastReadAt: cm.lastReadAt ?? null,
        };
      }),
    );
    return results;
  }
}
