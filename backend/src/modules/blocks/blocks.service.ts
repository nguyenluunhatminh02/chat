import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async block(blockerId: string, blockedUserId: string, expiresAt?: Date) {
    if (blockerId === blockedUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    try {
      return await this.prisma.block.create({
        data: {
          blockerId,
          blockedUserId,
          ...(expiresAt ? { expiresAt } : {}),
        },
      });
    } catch (e) {
      // idempotent: nếu đã block -> trả về bản ghi hiện có
      const exist = await this.prisma.block.findUnique({
        where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
      });
      if (exist) return exist;
      throw e;
    }
  }

  async unblock(blockerId: string, blockedUserId: string) {
    const exist = await this.prisma.block.findUnique({
      where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
    });
    if (!exist) {
      throw new NotFoundException('Not blocked');
    }
    await this.prisma.block.delete({
      where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
    });
    return { ok: true };
  }

  async list(blockerId: string) {
    return this.prisma.block.findMany({
      where: {
        blockerId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Có block hai chiều giữa A và B đang còn hiệu lực không? */
  async isBlockedEither(a: string, b: string) {
    const now = new Date();
    const res = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedUserId: b },
          { blockerId: b, blockedUserId: a },
        ],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        ],
      },
      select: { blockerId: true, blockedUserId: true },
    });
    return !!res;
  }
}
