import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { MessagingGateway } from '../../websockets/messaging.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
      try {
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
      } catch (error) {
        // If unique constraint error (P2002), it means reaction was already created by another concurrent request
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Just return as if it was added successfully
          this.gw.emitToConversation(msg.conversationId, 'reaction.added', {
            messageId: dto.messageId,
            userId,
            emoji: dto.emoji,
            createdAt: new Date(),
          });
          return { added: true };
        }
        throw error;
      }
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
