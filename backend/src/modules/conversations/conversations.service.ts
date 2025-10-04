import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ConversationTypeDto,
  CreateConversationDto,
} from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationType } from 'generated/prisma';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateConversationDto) {
    if (dto.type === ConversationTypeDto.DIRECT && dto.members.length !== 1) {
      throw new BadRequestException('DIRECT cần đúng 1 thành viên');
    }
    // v1: chưa dedupe DIRECT; sẽ thêm ở bước nâng cấp
    const conv = await this.prisma.conversation.create({
      data: {
        type: dto.type as unknown as ConversationType,
        title: dto.title ?? null,
        createdById: creatorId,
        members: {
          create: [
            { userId: creatorId, role: 'OWNER' as any },
            ...dto.members.map((u) => ({ userId: u, role: 'MEMBER' as any })),
          ],
        },
      },
      include: { members: true },
    });
    return conv;
  }

  async listForUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: { members: true },
    });

    // Fetch last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.prisma.message.findFirst({
          where: {
            conversationId: conv.id,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!lastMessage) {
          return { ...conv, lastMessage: null };
        }

        // Fetch user info separately
        const user = await this.prisma.user.findUnique({
          where: { id: lastMessage.senderId },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });

        return {
          ...conv,
          lastMessage: {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt.toISOString(),
            user: user || {
              id: lastMessage.senderId,
              email: 'Unknown',
              name: null,
            },
          },
        };
      }),
    );

    return conversationsWithLastMessage;
  }
}
