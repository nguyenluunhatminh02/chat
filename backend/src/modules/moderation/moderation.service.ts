import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { OutboxProducer } from '../outbox/outbox.producer';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private blocks: BlocksService,
    private outbox: OutboxProducer,
  ) {}

  async report(
    reporterId: string,
    dto: {
      type: 'MESSAGE' | 'USER' | 'CONVERSATION';
      targetMessageId?: string;
      targetUserId?: string;
      targetConversationId?: string;
      reason: 'SPAM' | 'ABUSE' | 'NSFW' | 'HARASSMENT' | 'OTHER';
      details?: string;
    },
  ) {
    // evidence snapshot nếu report message
    let evidence: any = undefined;
    if (dto.type === 'MESSAGE' && dto.targetMessageId) {
      const msg = await this.prisma.message.findUnique({
        where: { id: dto.targetMessageId },
      });
      if (msg) {
        evidence = {
          message: {
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          },
        };
      }
    }
    return this.prisma.report.create({
      data: { ...dto, reporterId, evidence },
    });
  }

  async listReports(status?: 'OPEN' | 'RESOLVED' | 'REJECTED') {
    const reports = await this.prisma.report.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Map reporterId to reportedBy for frontend compatibility
    return reports.map((report) => ({
      ...report,
      reportedBy: report.reporterId,
    }));
  }

  async resolve(
    reportId: string,
    adminUserId: string,
    body: {
      action?: 'NONE' | 'DELETE_MESSAGE' | 'BLOCK_USER' | 'GLOBAL_BAN';
      resolutionNotes?: string;
    },
  ) {
    const rep = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!rep) throw new NotFoundException('Report not found');

    // Thực thi action
    if (body.action === 'DELETE_MESSAGE') {
      if (!rep.targetMessageId) {
        throw new ForbiddenException('No message target');
      }
      // Soft delete trực tiếp (bỏ qua quyền), emit outbox
      const msg = await this.prisma.message.update({
        where: { id: rep.targetMessageId },
        data: { deletedAt: new Date(), content: null },
        select: { id: true, conversationId: true },
      });
      await this.outbox.emit('messaging.message_deleted', {
        messageId: msg.id,
        conversationId: msg.conversationId,
      });
    }

    if (body.action === 'BLOCK_USER') {
      if (!rep.targetUserId) {
        throw new ForbiddenException('No user target');
      }
      // block 1 chiều: reporter chặn targetUser
      await this.blocks.block(rep.reporterId, rep.targetUserId);
    }

    if (body.action === 'GLOBAL_BAN') {
      if (!rep.targetUserId) {
        throw new ForbiddenException('No user target');
      }
      // Global ban: create Ban record (permanent)
      await this.prisma.ban.create({
        data: {
          userId: rep.targetUserId,
          bannedById: adminUserId,
          reason: rep.reason,
          notes: body.resolutionNotes,
          expiresAt: null, // Permanent ban
        },
      });
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'RESOLVED',
        action: body.action ?? 'NONE',
        resolutionNotes: body.resolutionNotes ?? null,
        resolvedById: adminUserId,
        resolvedAt: new Date(),
      },
    });
    return updated;
  }

  // Group moderation
  async kickMember(conversationId: string, userId: string, kickedBy: string) {
    // Check if kicker is ADMIN or OWNER
    const kicker = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: kickedBy } },
    });
    if (!kicker || !['ADMIN', 'OWNER'].includes(kicker.role)) {
      throw new ForbiddenException('Only admin/owner can kick');
    }

    // Cannot kick owner
    const target = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (target?.role === 'OWNER') {
      throw new ForbiddenException('Cannot kick owner');
    }

    // Remove member
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });

    return { ok: true, message: 'User kicked' };
  }

  async banMember(
    conversationId: string,
    userId: string,
    bannedBy: string,
    reason?: string,
    expiresAt?: Date,
  ) {
    // Check permissions
    const banner = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: bannedBy } },
    });
    if (!banner || !['ADMIN', 'OWNER'].includes(banner.role)) {
      throw new ForbiddenException('Only admin/owner can ban');
    }

    const target = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (target?.role === 'OWNER') {
      throw new ForbiddenException('Cannot ban owner');
    }

    // Create ban
    await this.prisma.conversationBan.create({
      data: {
        conversationId,
        userId,
        bannedBy,
        reason,
        expiresAt,
      },
    });

    // Also kick them out
    if (target) {
      await this.prisma.conversationMember.delete({
        where: { conversationId_userId: { conversationId, userId } },
      });
    }

    return { ok: true, message: 'User banned' };
  }

  async unbanMember(
    conversationId: string,
    userId: string,
    unbannedBy: string,
  ) {
    const unbanner = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: unbannedBy } },
    });
    if (!unbanner || !['ADMIN', 'OWNER'].includes(unbanner.role)) {
      throw new ForbiddenException('Only admin/owner can unban');
    }

    const ban = await this.prisma.conversationBan.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    await this.prisma.conversationBan.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });

    return { ok: true, message: 'User unbanned' };
  }

  async listBans(conversationId: string) {
    return this.prisma.conversationBan.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isBanned(conversationId: string, userId: string): Promise<boolean> {
    const now = new Date();
    const ban = await this.prisma.conversationBan.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt < now) {
      // Expired, delete it
      await this.prisma.conversationBan.delete({
        where: { conversationId_userId: { conversationId, userId } },
      });
      return false;
    }
    return true;
  }

  // Appeal system
  async createAppeal(
    userId: string,
    dto: {
      reportId?: string;
      banId?: string; // format: "conversationId:userId"
      reason: string;
    },
  ) {
    return this.prisma.appeal.create({
      data: {
        userId,
        reportId: dto.reportId,
        banId: dto.banId,
        reason: dto.reason,
      },
    });
  }

  async listAppeals(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.prisma.appeal.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reviewAppeal(
    appealId: string,
    reviewedBy: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ) {
    const appeal = await this.prisma.appeal.findUnique({
      where: { id: appealId },
    });
    if (!appeal) throw new NotFoundException('Appeal not found');

    const updated = await this.prisma.appeal.update({
      where: { id: appealId },
      data: {
        status: decision,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
      },
    });

    // If approved, take action
    if (decision === 'APPROVED') {
      if (appeal.banId) {
        // Unban format: "conversationId:userId"
        const [conversationId, userId] = appeal.banId.split(':');
        const ban = await this.prisma.conversationBan.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (ban) {
          await this.prisma.conversationBan.delete({
            where: { conversationId_userId: { conversationId, userId } },
          });
        }
      }
      // Could also reverse report actions if needed
    }

    return updated;
  }
}
