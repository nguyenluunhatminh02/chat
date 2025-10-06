import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { Readable, PassThrough } from 'stream';
import * as zlib from 'zlib';

// Configuration constants for optimization
const BATCH_SIZE = 200; // Messages per batch
const IMPORT_BATCH_SIZE = 100; // Import batch size
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

type ExportOpts = {
  format: 'json' | 'ndjson';
  gzip?: boolean;
  files?: 'meta' | 'presigned';
};

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  // ===== EXPORT =====
  /** Verify user has access to conversation */
  private async assertMemberOfConversation(
    userId: string,
    conversationId: string,
  ) {
    const m = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { userId: true },
    });
    if (!m) {
      this.logger.warn(
        `Access denied: User ${userId} not member of conversation ${conversationId}`,
      );
      throw new ForbiddenException('Not a member of this conversation');
    }
  }

  private async presignIfNeeded(key: string, filesMode?: 'meta' | 'presigned') {
    if (filesMode === 'presigned') {
      const { url } = await this.files.presignGet(key);
      return url;
    }
    return undefined;
  }

  /** Stream NDJSON */
  async streamConversationNdjson(
    res: any,
    userId: string,
    conversationId: string,
    opts: ExportOpts,
  ) {
    await this.assertMemberOfConversation(userId, conversationId);

    this.logger.log(
      `Starting NDJSON export for conversation ${conversationId}`,
    );

    // Set response headers
    const filename = `conversation-${conversationId}-${Date.now()}.ndjson${opts.gzip ? '.gz' : ''}`;
    const mime = 'application/x-ndjson';
    res.setHeader?.('Content-Type', mime);
    res.setHeader?.(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.header?.('Content-Type', mime);
    res.header?.('Content-Disposition', `attachment; filename="${filename}"`);

    // Create streaming pipeline
    const pass = new PassThrough({ highWaterMark: 64 * 1024 }); // 64KB buffer
    const output = opts.gzip ? pass.pipe(zlib.createGzip()) : pass;

    // Handle streaming errors
    output.on('error', (err) => {
      this.logger.error(`Stream error during export: ${err.message}`);
    });

    if (res.raw) output.pipe(res.raw);
    else output.pipe(res);

    const writeLine = (obj: any) => pass.write(JSON.stringify(obj) + '\n');

    // 1) Meta
    writeLine({
      type: 'meta',
      version: 'chatapp/1.0',
      exportedAt: new Date().toISOString(),
    });

    // 2) Conversation + members
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        workspaceId: true,
        type: true,
        title: true,
        createdById: true,
        createdAt: true,
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    writeLine({
      type: 'conversation',
      id: convo.id,
      workspaceId: convo.workspaceId,
      payload: convo,
    });

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    // 3) Users
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    for (const u of users) writeLine({ type: 'user', id: u.id, payload: u });

    // 4) Messages + attachments (stream theo batch)
    const pageSize = 200;
    let cursor: string | undefined = undefined;
    let batchCount = 0;
    let totalMessages = 0;

    while (true) {
      const batch = await this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: pageSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          type: true,
          content: true,
          createdAt: true,
          editedAt: true,
          attachment: {
            select: {
              id: true,
              messageId: true,
              file: {
                select: {
                  bucket: true,
                  key: true,
                  mime: true,
                  size: true,
                  thumbKey: true,
                },
              },
            },
          },
        },
      });

      if (!batch.length) break;

      batchCount++;
      totalMessages += batch.length;

      // Log progress every 5 batches
      if (batchCount % 5 === 0) {
        this.logger.log(`Exported ${totalMessages} messages...`);
      }

      for (const m of batch) {
        writeLine({
          type: 'message',
          id: m.id,
          conversationId: m.conversationId,
          payload: {
            senderId: m.senderId,
            type: m.type,
            content: m.content,
            createdAt: m.createdAt,
            editedAt: m.editedAt,
          },
        });

        // Handle attachments (array relation in Prisma schema)
        if (m.attachment && Array.isArray(m.attachment)) {
          for (const att of m.attachment) {
            const presignedUrl = await this.presignIfNeeded(
              att.file.key,
              opts.files,
            );
            writeLine({
              type: 'attachment',
              id: att.id,
              messageId: m.id,
              payload: {
                file: {
                  ...att.file,
                  presignedUrl: presignedUrl ?? undefined,
                },
              },
            });
          }
        }
      }

      cursor = batch[batch.length - 1].id;
    }

    this.logger.log(`Export completed: ${totalMessages} messages`);
    pass.end();
  }

  /** Tải về JSON đầy đủ */
  async downloadConversationJson(
    res: any,
    userId: string,
    conversationId: string,
    opts: ExportOpts,
  ) {
    await this.assertMemberOfConversation(userId, conversationId);

    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        workspaceId: true,
        type: true,
        title: true,
        createdById: true,
        createdAt: true,
      },
    });
    if (!convo) throw new NotFoundException('Conversation not found');

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    // messages
    const messages = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        type: true,
        content: true,
        createdAt: true,
        editedAt: true,
        attachment: {
          select: {
            id: true,
            messageId: true,
            file: {
              select: {
                bucket: true,
                key: true,
                mime: true,
                size: true,
                thumbKey: true,
              },
            },
          },
        },
      },
    });

    const body: any = {
      version: 'chatapp/1.0',
      exportedAt: new Date().toISOString(),
      conversation: convo,
      users,
      messages: await Promise.all(
        messages.map(async (m) => {
          // m.attachment is an array
          const attachments = await Promise.all(
            (m.attachment || []).map(async (att) => ({
              id: att.id,
              messageId: att.messageId,
              file: {
                bucket: att.file.bucket,
                key: att.file.key,
                mime: att.file.mime,
                size: att.file.size,
                thumbKey: att.file.thumbKey,
                presignedUrl:
                  opts.files === 'presigned'
                    ? await this.presignIfNeeded(att.file.key, 'presigned')
                    : undefined,
              },
            })),
          );
          return {
            id: m.id,
            senderId: m.senderId,
            type: m.type,
            content: m.content,
            createdAt: m.createdAt,
            editedAt: m.editedAt,
            attachments,
          };
        }),
      ),
    };

    const filename = `conversation-${conversationId}-${Date.now()}.json${opts.gzip ? '.gz' : ''}`;
    if (res.setHeader) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    } else if (res.header) {
      res.header('Content-Type', 'application/json');
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
    }

    const raw = Buffer.from(JSON.stringify(body, null, 2));
    if (opts.gzip) {
      const gz = zlib.gzipSync(raw);
      if (res.raw) res.raw.end(gz);
      else res.end(gz);
    } else {
      if (res.raw) res.raw.end(raw);
      else res.end(raw);
    }
  }

  // ===== IMPORT (NDJSON) =====
  async importNdjson(
    req: any,
    userId: string,
    workspaceId: string,
    params: {
      mode: 'create' | 'merge';
      conversationId?: string;
      preserveIds?: boolean;
      rehydrate?: boolean;
      gzip?: boolean;
    },
  ) {
    // Chuẩn bị stream đọc
    let src: Readable = req;
    if (
      params.gzip ||
      (req.headers && req.headers['content-encoding'] === 'gzip')
    ) {
      src = req.pipe(zlib.createGunzip());
    }

    // State
    let targetConversationId = params.conversationId ?? '';
    let createdConversation = false;

    // Map id cũ -> mới
    const msgIdMap = new Map<string, string>();

    // Đếm
    const usersSeen = new Set<string>();
    let messages = 0;
    let attachments = 0;

    const buffer: Buffer[] = [];
    let leftover = '';

    // Helpers
    const parseLine = (line: string) => {
      if (!line.trim()) return null;
      return JSON.parse(line);
    };

    const ensureConvo = async (payload: any) => {
      if (params.mode === 'merge') {
        if (!targetConversationId)
          throw new BadRequestException('conversationId required for merge');
        await this.assertMemberOfConversation(userId, targetConversationId);
        return targetConversationId;
      }
      if (!createdConversation) {
        const c = await this.prisma.conversation.create({
          data: {
            id: params.preserveIds ? (payload.id ?? undefined) : undefined,
            type: payload.type,
            title: payload.title ?? null,
            createdById: userId,
            workspaceId,
          },
        });
        createdConversation = true;
        targetConversationId = c.id;
      }
      return targetConversationId;
    };

    const addMembersIfMissing = async (candidateUserIds: string[]) => {
      if (!candidateUserIds.length) return;
      const exists = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { in: candidateUserIds } },
        select: { userId: true },
      });
      const allowed = new Set(exists.map((e) => e.userId));
      const needCreate = candidateUserIds.filter((u) => allowed.has(u));
      await this.prisma.conversationMember.createMany({
        data: needCreate.map((uid) => ({
          conversationId: targetConversationId,
          userId: uid,
        })),
        skipDuplicates: true,
      });
    };

    // Đọc chunk, tách dòng
    for await (const chunk of src as any as AsyncIterable<Buffer>) {
      buffer.push(chunk);
      const text = leftover + Buffer.concat(buffer).toString('utf8');
      buffer.length = 0;

      const lines = text.split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        const obj = parseLine(line);
        if (!obj) continue;
        switch (obj.type) {
          case 'meta':
            break;
          case 'conversation': {
            const payload = obj.payload || {};
            await ensureConvo(payload);
            break;
          }
          case 'user': {
            usersSeen.add(obj.id);
            break;
          }
          case 'message': {
            if (!targetConversationId)
              throw new BadRequestException('conversation not initialized');
            const p = obj.payload || {};
            const originalId = obj.id as string;
            const created = await this.prisma.message.create({
              data: {
                id: params.preserveIds ? originalId : undefined,
                conversationId: targetConversationId,
                senderId: p.senderId,
                type: p.type,
                content: p.content ?? null,
                createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
                editedAt: p.editedAt ? new Date(p.editedAt) : undefined,
              },
            });
            messages++;
            msgIdMap.set(originalId, created.id);
            await addMembersIfMissing([p.senderId]);
            break;
          }
          case 'attachment': {
            if (!targetConversationId)
              throw new BadRequestException('conversation not initialized');
            const p = obj.payload || {};
            const mId =
              msgIdMap.get(obj.messageId) ??
              (params.preserveIds ? obj.messageId : undefined);
            if (!mId) break;
            const f = p.file;
            if (f?.bucket && f?.key) {
              await this.prisma.fileObject.upsert({
                where: { bucket_key: { bucket: f.bucket, key: f.key } },
                update: {
                  mime: f.mime ?? undefined,
                  size: f.size ?? undefined,
                  thumbKey: f.thumbKey ?? undefined,
                  status: 'READY' as any,
                },
                create: {
                  bucket: f.bucket,
                  key: f.key,
                  mime: f.mime ?? 'application/octet-stream',
                  size: f.size ?? null,
                  thumbKey: f.thumbKey ?? null,
                  status: 'READY' as any,
                },
              });
              const fileObj = await this.prisma.fileObject.findUnique({
                where: { bucket_key: { bucket: f.bucket, key: f.key } },
                select: { id: true },
              });
              if (fileObj) {
                await this.prisma.attachment.create({
                  data: {
                    id: params.preserveIds ? obj.id : undefined,
                    messageId: mId!,
                    fileId: fileObj.id,
                  },
                });
                attachments++;
              }
            }
            break;
          }
          default:
            break;
        }
      }
    }

    // Thêm các user vào conversation
    if (params.mode === 'create' && usersSeen.size) {
      await addMembersIfMissing(Array.from(usersSeen));
    }

    return { conversationId: targetConversationId, messages, attachments };
  }
}
