import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const TOKEN_RE = /<@([a-zA-Z0-9_\-:.]+)>/g; // matches <@u123> / <@all> / <@here>

@Injectable()
export class MentionsService {
  constructor(private prisma: PrismaService) {}

  /** Parse token <@userId> / <@all> / <@here> từ content */
  parse(content: string): {
    userIds: string[];
    hasAll: boolean;
    hasHere: boolean;
  } {
    const set = new Set<string>();
    let hasAll = false,
      hasHere = false;
    for (const m of content.matchAll(TOKEN_RE)) {
      const id = (m[1] || '').toLowerCase();
      if (id === 'all') hasAll = true;
      else if (id === 'here') hasHere = true;
      else set.add(m[1]);
    }
    return { userIds: [...set], hasAll, hasHere };
  }

  /** Tạo rows Mention cho 1 message (loại trừ sender, chỉ giữ member của room) */
  async createForMessage(msg: {
    id: string;
    conversationId: string;
    senderId: string;
    content?: string | null;
  }) {
    const content = msg.content ?? '';
    const { userIds, hasAll, hasHere } = this.parse(content);

    // thành viên của room
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: msg.conversationId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));

    // expand @all/@here -> tất cả thành viên trừ sender
    if (hasAll || hasHere) {
      for (const uid of memberIds) userIds.push(uid);
    }
    // lọc: là member & không phải sender
    const final = [...new Set(userIds)].filter(
      (uid) => uid !== msg.senderId && memberIds.has(uid),
    );
    if (!final.length) return [];

    await this.prisma.mention.createMany({
      data: final.map((uid) => ({ messageId: msg.id, userId: uid })),
      skipDuplicates: true,
    });
    return final;
  }

  /** Gợi ý @user: lấy từ members của conversation, filter theo q trong name/email */
  async suggest(conversationId: string, q?: string, limit = 8) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: limit,
    });
    return users;
  }

  /** Hộp thư mentions của 1 user */
  async inbox(userId: string, cursor?: string, limit = 30) {
    const rows = await this.prisma.mention.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { messageId_userId: { messageId: cursor, userId } },
          }
        : {}),
      select: {
        createdAt: true,
        message: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            type: true,
            content: true,
            createdAt: true,
            deletedAt: true,
          },
        },
      },
    });
    return rows
      .filter((r) => !r.message.deletedAt)
      .map((r) => ({
        mentionedAt: r.createdAt,
        ...r.message,
      }));
  }
}
