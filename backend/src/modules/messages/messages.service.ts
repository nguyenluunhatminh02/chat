import { Injectable, ForbiddenException } from '@nestjs/common';
import { SendMessageDto } from './dto/send-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingGateway } from 'src/websockets/messaging.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
  ) {}

  async list(conversationId: string, cursor?: string, limit = 30) {
    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
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

    // 🔔 Phát realtime tới room của conversation (đang xem)
    this.gateway.emitToConversation(dto.conversationId, 'message.created', {
      message: msg,
    });

    // 🔔 Phát "unread.bump" tới từng user member (không phải người gửi)
    //  -> để các tab không đang mở phòng đó vẫn tăng unread realtime
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: dto.conversationId },
      select: { userId: true },
    });
    const others = members.map((m) => m.userId).filter((id) => id !== userId);
    this.gateway.emitToUsers(others, 'unread.bump', {
      conversationId: dto.conversationId,
      messageId: msg.id,
    });

    return msg;
  }
}
