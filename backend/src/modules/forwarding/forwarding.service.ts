import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ForwardOneInput = {
  messageId: string;
  targetConversationIds: string[];
  userId: string;
  includeAttribution?: boolean; // default: true
  atomic?: boolean; // default: false -> partial forward; true -> all-or-nothing
};

@Injectable()
export class ForwardingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Forward a single message to multiple conversations.
   * - Batch check membership cho nhanh
   * - Dedupe targetConversationIds
   * - Cho phép atomic (tất cả thành công hoặc rollback) hoặc partial (mặc định)
   */
  async forwardMessage(input: ForwardOneInput) {
    const { messageId, userId } = input;
    const includeAttribution = input.includeAttribution !== false;
    const atomic = input.atomic === true;

    // 1) Validate input
    if (
      !messageId ||
      !Array.isArray(input.targetConversationIds) ||
      input.targetConversationIds.length === 0
    ) {
      throw new BadRequestException('Invalid targetConversationIds');
    }
    const targetIds = Array.from(new Set(input.targetConversationIds)); // dedupe

    // 2) Lấy original message + attachments
    const original = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        attachment: {
          select: { fileId: true }, // chỉ cần fileId để copy
        },
      },
    });
    if (!original) throw new BadRequestException('Message not found');

    // 3) Kiểm tra quyền xem original
    const access = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: original.conversationId,
          userId,
        },
      },
    });
    if (!access)
      throw new ForbiddenException('Unauthorized to access original message');

    // 4) Batch check membership với target conversations
    const memberships = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        conversationId: { in: targetIds },
      },
      select: { conversationId: true },
    });
    const allowedSet = new Set(memberships.map((m) => m.conversationId));
    const allowedTargets = targetIds.filter((id) => allowedSet.has(id));
    const skippedTargets = targetIds.filter((id) => !allowedSet.has(id));

    if (allowedTargets.length === 0) {
      return {
        success: false,
        forwardedCount: 0,
        skipped: skippedTargets.map((id) => ({
          conversationId: id,
          reason: 'not_member',
        })),
        messages: [],
      };
    }

    // 5) Build metadata forward
    const baseOriginalMeta = (
      original.metadata && typeof original.metadata === 'object'
        ? original.metadata
        : {}
    ) as Record<string, unknown>;

    const forwardMetaBase: Record<string, unknown> = {
      forwarded: true,
      originalMessageId: original.id,
      originalConversationId: original.conversationId,
      originalSenderId: original.senderId,
    };
    if (includeAttribution) forwardMetaBase.showAttribution = true;

    // attachments payload (reuse cùng fileId — không clone binary)
    const attachmentsCreate = original.attachment.map((att) => ({
      fileId: att.fileId,
    }));

    // 6) Hàm tạo message forward cho 1 conversation
    const createForwardFor = (conversationId: string) =>
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          type: original.type,
          content: original.content,
          metadata: { ...baseOriginalMeta, ...forwardMetaBase } as any,
          attachment: attachmentsCreate.length
            ? { create: attachmentsCreate }
            : undefined,
        },
        include: {
          attachment: { include: { file: true } },
        },
      });

    // 7) Thực thi
    if (atomic) {
      // All-or-nothing trong 1 transaction
      const messages = await this.prisma.$transaction(async (tx) => {
        // tạo tất cả forwarded messages
        const created = await Promise.all(
          allowedTargets.map((cid) =>
            tx.message.create({
              data: {
                conversationId: cid,
                senderId: userId,
                type: original.type,
                content: original.content,
                metadata: { ...baseOriginalMeta, ...forwardMetaBase } as any,
                attachment: attachmentsCreate.length
                  ? { create: attachmentsCreate }
                  : undefined,
              },
              include: { attachment: { include: { file: true } } },
            }),
          ),
        );

        // update updatedAt cho conversations (batch)
        await Promise.all(
          allowedTargets.map((cid) =>
            tx.conversation.update({
              where: { id: cid },
              data: { updatedAt: new Date() },
            }),
          ),
        );

        return created;
      });

      return {
        success: true,
        forwardedCount: messages.length,
        skipped: skippedTargets.map((id) => ({
          conversationId: id,
          reason: 'not_member',
        })),
        messages,
      };
    }

    // Partial mode (mặc định): forward từng cái, cái lỗi thì bỏ qua
    const messages: any[] = [];
    const errors: Array<{ conversationId: string; error: string }> = [];

    for (const cid of allowedTargets) {
      try {
        const msg = await createForwardFor(cid);
        await this.prisma.conversation.update({
          where: { id: cid },
          data: { updatedAt: new Date() },
        });
        messages.push(msg);
      } catch (e: any) {
        errors.push({
          conversationId: cid,
          error: e?.message ?? 'Unknown error',
        });
      }
    }

    return {
      success: errors.length === 0,
      forwardedCount: messages.length,
      skipped: [
        ...skippedTargets.map((id) => ({
          conversationId: id,
          reason: 'not_member',
        })),
        ...errors.map((e) => ({
          conversationId: e.conversationId,
          reason: e.error,
        })),
      ],
      messages,
    };
  }

  /**
   * Forward nhiều message vào 1 conversation (partial theo từng message)
   */
  async forwardMultipleMessages(data: {
    messageIds: string[];
    targetConversationId: string;
    userId: string;
    includeAttribution?: boolean;
    atomicPerMessage?: boolean; // default false
  }) {
    const results: any[] = [];
    for (const mid of data.messageIds) {
      try {
        const result = await this.forwardMessage({
          messageId: mid,
          targetConversationIds: [data.targetConversationId],
          userId: data.userId,
          includeAttribution: data.includeAttribution,
          atomic: data.atomicPerMessage === true,
        });
        results.push({ messageId: mid, success: true, result });
      } catch (error: any) {
        results.push({
          messageId: mid,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }
    return results;
  }

  /**
   * Trả về info “được forward” của 1 message
   */
  async getForwardingInfo(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { metadata: true },
    });
    const metadata = message?.metadata as any;
    if (!metadata || typeof metadata !== 'object' || !metadata.forwarded)
      return null;

    return {
      isForwarded: true,
      originalMessageId: metadata.originalMessageId,
      originalConversationId: metadata.originalConversationId,
      originalSenderId: metadata.originalSenderId,
      showAttribution: !!metadata.showAttribution,
    };
  }
}
