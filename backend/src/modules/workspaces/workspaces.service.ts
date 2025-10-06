import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
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

    // Fetch users separately to handle missing users
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

    // Map members with user data (or placeholder if missing)
    return members.map((m) => ({
      ...m,
      user: userMap.get(m.userId) || {
        id: m.userId,
        email: 'unknown@example.com',
        name: 'Unknown User',
        avatarUrl: null,
      },
    }));
  }

  async assertMember(userId: string, workspaceId: string) {
    console.log('Asserting member', userId, workspaceId);

    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a member of workspace');
    return m.role;
  }
}
