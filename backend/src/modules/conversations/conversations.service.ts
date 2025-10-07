// src/modules/conversations/conversations.service.ts
import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationTypeDto,
  CreateConversationDto,
} from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationType } from 'generated/prisma';
import { OutboxProducer } from '../outbox/outbox.producer';
import { FilesService } from '../files/files.service';
import type { Express } from 'express';
import { fetch } from 'undici'; // nếu Node < 18, đảm bảo cài undici

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private outbox: OutboxProducer,
    private filesService: FilesService,
  ) {}

  async create(
    creatorId: string,
    dto: CreateConversationDto,
    workspaceId: string,
  ) {
    if (dto.type === ConversationTypeDto.DIRECT && dto.members.length !== 1) {
      throw new BadRequestException('DIRECT cần đúng 1 thành viên');
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type: dto.type as unknown as ConversationType,
        title: dto.title ?? null,
        createdById: creatorId,
        workspaceId,
        members: {
          create: [
            { userId: creatorId, role: 'OWNER' as any },
            ...dto.members.map((u) => ({ userId: u, role: 'MEMBER' as any })),
          ],
        },
      },
      include: { members: true },
    });

    const allMemberIds = [creatorId, ...dto.members];

    await this.outbox.emit('conversation.created', {
      conversation: conv,
      memberIds: allMemberIds,
    });

    return conv;
  }

  async listForUser(userId: string, workspaceId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        members: { some: { userId } },
        workspaceId,
      },
      orderBy: { updatedAt: 'desc' },
      include: { members: true },
    });

    // (giữ nguyên, có thể tối ưu N+1 sau)
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.prisma.message.findFirst({
          where: { conversationId: conv.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });

        if (!lastMessage) {
          // Generate presigned avatar URL if avatarKey exists
          let avatarUrl;
          if (conv.avatarKey) {
            try {
              const { url } = await this.filesService.presignGet(
                conv.avatarKey,
                600, // 10 minutes
              );
              avatarUrl = url;
            } catch (err) {
              console.error('Error generating avatar URL:', err);
            }
          }

          return { ...conv, lastMessage: null, avatarUrl };
        }

        const user = await this.prisma.user.findUnique({
          where: { id: lastMessage.senderId },
          select: { id: true, email: true, name: true },
        });

        // Generate presigned avatar URL if avatarKey exists
        let avatarUrl;
        if (conv.avatarKey) {
          try {
            const { url } = await this.filesService.presignGet(
              conv.avatarKey,
              600, // 10 minutes
            );
            avatarUrl = url;
          } catch (err) {
            console.error('Error generating avatar URL:', err);
          }
        }

        return {
          ...conv,
          avatarUrl,
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

  /** ✅ Upload avatar: lưu key (ưu tiên thumbnail), KHÔNG lưu presigned URL */
  async uploadAvatar(
    conversationId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    // 1) Tồn tại + quyền
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const member = conversation.members.find((m) => m.userId === userId);
    if (!member || member.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can upload avatar');
    }

    // 2) Validate file ảnh
    if (!file?.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // 3) Presign PUT rồi upload
    const filename = `conv_avatar_${conversationId}_${Date.now()}.${file.mimetype.split('/')[1] || 'jpg'}`;

    const presign = await this.filesService.presignPut(
      filename,
      file.mimetype,
      5 * 1024 * 1024, // 5MB
    );

    const resp = await fetch(presign.url, {
      method: 'PUT',
      headers: { 'Content-Type': file.mimetype },
      body: file.buffer, // multer memory storage -> Buffer
    });
    if (!resp.ok) throw new BadRequestException('Failed to upload file to R2');

    // 4) Đánh dấu READY + tạo thumbnail (nhẹ hơn để hiển thị avatar)
    await this.filesService.complete(presign.fileId);
    const thumb = await this.filesService.createThumbnail(presign.fileId, 256);
    const avatarKey = thumb.thumbKey ?? presign.key;

    // 5) Lưu key + mốc cập nhật
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { avatarKey, avatarUpdatedAt: new Date() },
    });

    // 6) Phát realtime (client tự call getAvatarUrl để lấy URL mới)
    await this.outbox.emit('conversation.updated', {
      conversationId,
      avatarKey,
      memberIds: conversation.members.map((m) => m.userId),
    });

    // 7) Trả kèm presigned GET (tiện cho lần này)
    const { url } = await this.filesService.presignGet(avatarKey);
    return { avatarKey, avatarUrl: url };
  }

  /** Lấy presigned URL cho avatar (tồn tại trong thời gian ngắn) */
  async getAvatarUrl(conversationId: string, expiresIn = 600) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { avatarKey: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const avatarKey = conv.avatarKey;
    if (!avatarKey) throw new NotFoundException('Avatar not set');

    const { url } = await this.filesService.presignGet(avatarKey, expiresIn);
    return { url, expiresIn };
  }

  /** Xoá avatar (clear metadata; tuỳ chính sách có thể không xoá object vật lý) */
  async clearAvatar(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const requestor = conversation.members.find((m) => m.userId === userId);
    if (!requestor || requestor.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can clear avatar');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { avatarKey: null, avatarUpdatedAt: new Date() },
    });

    await this.outbox.emit('conversation.updated', {
      conversationId,
      avatarKey: null,
      memberIds: conversation.members.map((m) => m.userId),
    });

    return { ok: true };
  }

  async removeMember(conversationId: string, userId: string, memberId: string) {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        include: { members: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');

      if (conversation.type !== 'GROUP') {
        throw new BadRequestException(
          'Can only remove members from GROUP conversations',
        );
      }

      const requestor = conversation.members.find((m) => m.userId === userId);
      if (!requestor || requestor.role !== 'OWNER') {
        throw new ForbiddenException('Only owners can remove members');
      }

      if (memberId === userId) {
        throw new BadRequestException(
          'Cannot remove yourself. Use leave group instead.',
        );
      }

      const target = conversation.members.find((m) => m.userId === memberId);
      if (!target) {
        throw new NotFoundException('Member not found in this conversation');
      }

      // ⛔️ Không cho xoá OWNER cuối cùng
      if (target.role === 'OWNER') {
        const ownerCount = conversation.members.filter(
          (m) => m.role === 'OWNER',
        ).length;
        if (ownerCount <= 1) {
          throw new BadRequestException(
            'Cannot remove the last owner. Transfer ownership first.',
          );
        }
      }

      // Xoá membership (chọn 1 trong 2 cách)
      // Cách A: delete theo composite unique
      // await tx.conversationMember.delete({
      //   where: { conversationId_userId: { conversationId, userId: memberId } },
      // });

      // Cách B: deleteMany (an toàn khi nghi vấn key)
      const { count } = await tx.conversationMember.deleteMany({
        where: { conversationId, userId: memberId },
      });
      if (count === 0) {
        throw new NotFoundException('Membership already removed');
      }

      const remainingMemberIds = conversation.members
        .filter((m) => m.userId !== memberId)
        .map((m) => m.userId);

      await this.outbox.emit('member.removed', {
        conversationId,
        removedUserId: memberId,
        removedBy: userId,
        memberIds: remainingMemberIds,
      });

      return { success: true, message: 'Member removed successfully' };
    });
  }

  /** ✅ Add member to GROUP conversation with realtime update */
  async addMember(
    conversationId: string,
    userId: string,
    newMemberId: string,
    workspaceId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Validate conversation exists and is GROUP
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        include: { members: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');

      if (conversation.type !== 'GROUP') {
        throw new BadRequestException(
          'Can only add members to GROUP conversations',
        );
      }

      // 2) Check requestor is OWNER or ADMIN
      const requestor = conversation.members.find((m) => m.userId === userId);
      if (!requestor || !['OWNER', 'ADMIN'].includes(requestor.role)) {
        throw new ForbiddenException('Only owners and admins can add members');
      }

      // 3) Check if member already exists
      const existingMember = conversation.members.find(
        (m) => m.userId === newMemberId,
      );
      if (existingMember) {
        throw new BadRequestException('User is already a member');
      }

      // 4) Check if user exists in workspace
      const workspaceMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: newMemberId },
        },
      });

      if (!workspaceMember) {
        throw new BadRequestException('User must be a workspace member first');
      }

      // 5) Add member
      await tx.conversationMember.create({
        data: {
          conversationId,
          userId: newMemberId,
          role: 'MEMBER',
        },
      });

      // 6) Get updated member list
      const updatedMembers = await tx.conversationMember.findMany({
        where: { conversationId },
      });

      const allMemberIds = updatedMembers.map((m) => m.userId);

      // 7) Emit realtime event
      await this.outbox.emit('member.added', {
        conversationId,
        addedUserId: newMemberId,
        addedBy: userId,
        memberIds: allMemberIds,
      });

      return {
        success: true,
        message: 'Member added successfully',
        memberId: newMemberId,
      };
    });
  }
}
