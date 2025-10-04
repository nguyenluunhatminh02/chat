import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { UpdateMessageDto } from './dto/update-message.dto';
import { OutboxProducer } from '../outbox/outbox.producer';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
    private outbox: OutboxProducer,
  ) {}

  async list(
    conversationId: string,
    cursor?: string,
    limit = 30,
    includeDeleted = true,
  ) {
    return this.prisma.message.findMany({
      where: includeDeleted
        ? { conversationId }
        : { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async send(userId: string, dto: SendMessageDto) {
    // Kiểm tra user là member của conversation
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: dto.conversationId, userId },
      },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    // ✅ Nếu là reply thì kiểm tra parent hợp lệ
    if (dto.parentId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: dto.parentId },
        select: { conversationId: true },
      });
      if (!parent || parent.conversationId !== dto.conversationId) {
        throw new ForbiddenException('Invalid parent message');
      }
    }

    // Tạo message + cập nhật updatedAt của conversation để nổi lên đầu
    const [msg] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          type: dto.type as any,
          content: dto.content ?? null,
          parentId: dto.parentId ?? null,
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // // 🔔 Phát realtime tới room của conversation (đang xem)
    // this.gateway.emitToConversation(dto.conversationId, 'message.created', {
    //   message: msg,
    // });
    // 🔁 Thay vì phát WS ngay, ta ghi Outbox trong transaction riêng (hoặc dùng $transaction hiện tại nếu bạn wrap khác)
    await this.outbox.emit('messaging.message_created', {
      messageId: msg.id,
      conversationId: dto.conversationId,
    });

    // 🔔 Phát "unread.bump" tới từng user member (không phải người gửi)
    //  -> để các tab không đang mở phòng đó vẫn tăng unread realtime
    // const members = await this.prisma.conversationMember.findMany({
    //   where: { conversationId: dto.conversationId },
    //   select: { userId: true },
    // });
    // const others = members.map((m) => m.userId).filter((id) => id !== userId);
    // this.gateway.emitToUsers(others, 'unread.bump', {
    //   conversationId: dto.conversationId,
    //   messageId: msg.id,
    // });

    // 2) outbox cho "unread.bump" (thay vì emit trực tiếp)
    await this.outbox.emit('messaging.unread_bump', {
      conversationId: dto.conversationId,
      messageId: msg.id,
      excludeUserId: userId, // không bắn về người gửi
    });

    return msg;
  }

  async thread(parentId: string, cursor?: string, limit = 30) {
    return await this.prisma.message.findMany({
      where: { parentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async edit(userId: string, messageId: string, dto: UpdateMessageDto) {
    if (!dto.content?.trim()) throw new BadRequestException('Content required');

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        deletedAt: true,
      },
    });
    if (!msg) throw new NotFoundException('Message not found');

    // chỉ cho chính người gửi sửa
    if (msg.senderId !== userId)
      throw new ForbiddenException('Only sender can edit');
    if (msg.deletedAt) throw new BadRequestException('Message already deleted');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
    });

    this.gateway.emitToConversation(msg.conversationId, 'message.updated', {
      id: updated.id,
      content: updated.content,
      editedAt: updated.editedAt,
    });

    // NEW: outbox cho search
    await this.outbox.emit('messaging.message_updated', {
      messageId: updated.id,
    });

    return updated;
  }

  // ====== NEW: Soft delete ======
  async softDelete(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        deletedAt: true,
      },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.deletedAt) return msg; // idempotent

    // cho phép: chính sender hoặc member có role ADMIN/OWNER
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: msg.conversationId, userId },
      },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    const isSender = msg.senderId === userId;
    const canAdmin = member.role === 'ADMIN' || member.role === 'OWNER';
    if (!isSender && !canAdmin)
      throw new ForbiddenException('No permission to delete');

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: null }, // xóa nội dung hiển thị
    });

    this.gateway.emitToConversation(msg.conversationId, 'message.deleted', {
      id: deleted.id,
      deletedAt: deleted.deletedAt,
    });

    // NEW: outbox cho search
    await this.outbox.emit('messaging.message_deleted', {
      messageId: deleted.id,
    });

    return deleted;
  }

  /**
   * Lấy cửa sổ tin nhắn quanh 1 messageId (bao gồm cả tin đã xoá để hiện placeholder).
   * Trả theo thứ tự thời gian tăng dần.
   */
  async around(userId: string, messageId: string, before = 20, after = 20) {
    const anchor = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!anchor) throw new NotFoundException('Message not found');

    // an toàn: chỉ thành viên convo đó được xem
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: anchor.conversationId,
          userId,
        },
      },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    // NOTE: KHÔNG lọc deletedAt để FE có thể render "Tin nhắn đã bị xoá"
    const beforeRows = await this.prisma.message.findMany({
      where: {
        conversationId: anchor.conversationId,
        OR: [
          { createdAt: { lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { lt: anchor.id } }, // tie-break
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(0, before),
    });

    const afterRows = await this.prisma.message.findMany({
      where: {
        conversationId: anchor.conversationId,
        OR: [
          { createdAt: { gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { gt: anchor.id } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.max(0, after),
    });

    const beforeAsc = beforeRows.slice().reverse();
    const messages = [...beforeAsc, anchor, ...afterRows];

    return {
      conversationId: anchor.conversationId,
      anchorId: anchor.id,
      messages,
    };
  }
}
