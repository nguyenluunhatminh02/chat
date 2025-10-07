import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
    // Ensure user exists (auto-create if missing)
    await this.prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: `${ownerId}@placeholder.local`,
        name: `User ${ownerId.slice(0, 8)}`,
      },
    });

    const ws = await this.prisma.workspace.create({ data: { name } });
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: ownerId,
        role: 'OWNER' as any,
      },
    });
    return ws;
  }

  async myWorkspaces(userId: string) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.workspaceId,
      name: r.workspace.name,
      role: r.role,
      joinedAt: r.joinedAt,
    }));
  }

  async addMember(
    actingUserId: string,
    workspaceId: string,
    userId: string,
    role: 'MEMBER' | 'ADMIN' = 'MEMBER',
  ) {
    const me = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actingUserId } },
    });
    if (!me || (me.role !== 'OWNER' && me.role !== 'ADMIN')) {
      throw new ForbiddenException('Not allowed');
    }

    // Ensure user exists (auto-create if missing)
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@placeholder.local`,
        name: `User ${userId.slice(0, 8)}`,
      },
    });

    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: { role: role as any },
      create: { workspaceId, userId, role: role as any },
    });
    return { ok: true };
  }

  async listMembers(actingUserId: string, workspaceId: string) {
    const me = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actingUserId } },
    });
    if (!me) throw new ForbiddenException('Not a member');

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        workspaceId: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    const userIds = members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return members.map((m) => {
      const userId = m.userId as string;
      const user = userMap.get(userId);
      return {
        ...m,
        user: user || {
          id: userId,
          email: 'unknown@example.com',
          name: 'Unknown User',
          avatarUrl: null,
        },
      };
    });
  }

  async assertMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a member of workspace');
    return m.role;
  }

  /** Dùng cho Guard để suy ra workspace từ conversationId */
  async getWorkspaceIdByConversationId(conversationId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!c) throw new NotFoundException('Conversation not found');
    return c.workspaceId;
  }
}
