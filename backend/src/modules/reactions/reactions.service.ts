import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { MessagingGateway } from '../../websockets/messaging.gateway';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReactionsService {
  constructor(
    private prisma: PrismaService,
    private gw: MessagingGateway,
  ) {}

  async toggle(userId: string, dto: ToggleReactionDto) {
    // Lấy message + conversation để emit đúng room
    const msg = await this.prisma.message.findUnique({
      where: { id: dto.messageId },
      select: { id: true, conversationId: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    // user phải là member của conversation
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: msg.conversationId, userId },
      },
      select: { userId: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    // Toggle: nếu tồn tại -> xóa; nếu chưa -> tạo
    const exists = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: dto.messageId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (exists) {
      await this.prisma.reaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId: dto.messageId,
            userId,
            emoji: dto.emoji,
          },
        },
      });
      this.gw.emitToConversation(msg.conversationId, 'reaction.removed', {
        messageId: dto.messageId,
        userId,
        emoji: dto.emoji,
      });
      return { removed: true };
    } else {
      const r = await this.prisma.reaction.create({
        data: { messageId: dto.messageId, userId, emoji: dto.emoji },
      });
      this.gw.emitToConversation(msg.conversationId, 'reaction.added', {
        messageId: dto.messageId,
        userId,
        emoji: dto.emoji,
        createdAt: r.createdAt,
      });
      return { added: true };
    }
  }

  async list(messageId: string) {
    return this.prisma.reaction.findMany({
      where: { messageId },
      orderBy: [{ emoji: 'asc' }, { createdAt: 'asc' }],
      select: { userId: true, emoji: true, createdAt: true },
    });
  }
}
