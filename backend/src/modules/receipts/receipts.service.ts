import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  // Đánh dấu đã đọc 1 message
  async markRead(userId: string, conversationId: string, messageId: string) {
    // 1) Kiểm tra user là member của conversation
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { lastReadAt: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    // 2) Lấy message để xác thực thuộc đúng conversation
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, createdAt: true },
    });
    if (!msg || msg.conversationId !== conversationId) {
      throw new NotFoundException('Message not found in conversation');
    }

    const readAt = new Date();

    // 3) Giao dịch: upsert ReadReceipt + nâng lastReadAt nếu nhỏ hơn msg.createdAt
    await this.prisma.$transaction(async (tx) => {
      await tx.readReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt },
        create: { messageId, userId },
      });

      // lastReadAt = max(lastReadAt, msg.createdAt)
      const newLastRead = new Date(
        Math.max(member.lastReadAt?.getTime() ?? 0, msg.createdAt.getTime()),
      );
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: newLastRead },
      });
    });

    return { ok: true, conversationId, messageId, readAt };
  }

  // Đếm số tin chưa đọc của user trong 1 conversation
  async unreadCount(userId: string, conversationId: string) {
    // Lấy lastReadAt
    const cm = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { lastReadAt: true },
    });
    if (!cm) throw new ForbiddenException('Not a member');

    const gtDate = cm.lastReadAt ?? new Date(0);
    const count = await this.prisma.message.count({
      where: {
        conversationId,
        deletedAt: null,
        createdAt: { gt: gtDate },
        NOT: { senderId: userId }, // không tính tin do chính mình gửi
      },
    });
    return { conversationId, unread: count, since: gtDate };
  }
}
