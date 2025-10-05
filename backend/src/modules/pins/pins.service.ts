import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxProducer } from '../outbox/outbox.producer';

@Injectable()
export class PinsService {
  private readonly logger = new Logger(PinsService.name);

  constructor(
    private prisma: PrismaService,
    private outbox: OutboxProducer,
  ) {}

  private canAdmin(role?: string) {
    return role === 'ADMIN' || role === 'OWNER';
  }

  /** Gỡ ngoặc kép/trim nếu userId bị double-encoded */
  private normalizeId(id: string) {
    if (!id) return id;
    let s = String(id).trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        s = JSON.parse(s);
      } catch {
        s = s.slice(1, -1);
      }
    }
    return s;
  }

  /** Pin message: idempotent, không throw khi trùng, emit chỉ khi insert mới */
  async add(userId: string, messageId: string) {
    const uid = this.normalizeId(userId);

    return this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.findUnique({
        where: { id: messageId },
        select: { id: true, conversationId: true, deletedAt: true },
      });
      if (!msg || msg.deletedAt)
        throw new NotFoundException('Message not found');

      const member = await tx.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: msg.conversationId,
            userId: uid,
          },
        },
        select: { role: true },
      });
      if (!member) throw new ForbiddenException('Not a member');

      // ⬇️ KHÔNG throw khi trùng nhờ skipDuplicates
      const res = await tx.pin.createMany({
        data: [
          { conversationId: msg.conversationId, messageId, pinnedBy: uid },
        ],
        skipDuplicates: true,
      });

      // Lấy row (đã có dù insert mới hay trùng)
      const pin = await tx.pin.findUnique({
        where: {
          conversationId_messageId: {
            conversationId: msg.conversationId,
            messageId,
          },
        },
      });

      // Chỉ emit khi thực sự tạo mới
      if (res.count === 1 && pin) {
        const eventKey = `conv:${msg.conversationId}:msg:${messageId}`;
        await this.outbox.emitInTx(tx, 'pin.added', eventKey, {
          conversationId: msg.conversationId,
          messageId,
          pinId: pin.id,
          pinnedBy: uid,
        });
      }

      // pin chắc chắn tồn tại tại đây
      return pin!;
    });
  }

  /** Unpin: idempotent */
  async remove(userId: string, messageId: string) {
    const uid = this.normalizeId(userId);

    return this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, deletedAt: true },
      });
      if (!msg || msg.deletedAt) return { ok: true };

      const member = await tx.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: msg.conversationId,
            userId: uid,
          },
        },
        select: { role: true },
      });
      if (!member) throw new ForbiddenException('Not a member');

      const existing = await tx.pin.findUnique({
        where: {
          conversationId_messageId: {
            conversationId: msg.conversationId,
            messageId,
          },
        },
        select: { id: true },
      });
      if (!existing) return { ok: true };

      await tx.pin.delete({
        where: {
          conversationId_messageId: {
            conversationId: msg.conversationId,
            messageId,
          },
        },
      });

      const eventKey = `conv:${msg.conversationId}:msg:${messageId}`;
      await this.outbox.emitInTx(tx, 'pin.removed', eventKey, {
        conversationId: msg.conversationId,
        messageId,
        removedBy: uid,
      });

      return { ok: true };
    });
  }

  /** List pins (cursor) */
  async list(conversationId: string, limit = 50, cursor?: string) {
    const rows = await this.prisma.pin.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        createdAt: true,
        pinnedBy: true,
        messageId: true,
        message: {
          select: {
            id: true,
            senderId: true,
            type: true,
            content: true,
            createdAt: true,
            editedAt: true,
            deletedAt: true,
          },
        },
      },
    });

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return {
      items: rows.map((p) => ({
        id: p.id,
        pinnedAt: p.createdAt,
        pinnedBy: p.pinnedBy,
        message: p.message,
      })),
      nextCursor,
    };
  }
}
