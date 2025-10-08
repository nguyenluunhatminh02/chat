import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { MessagesService } from '../messages/messages.service';
import { MessageTypeDto } from '../messages/dto/send-message.dto';
import { MessageType } from '../../../generated/prisma'; // Adjust the import path as necessary

@Injectable()
export class VoiceMessagesService {
  // Chấp nhận cả video/webm do MediaRecorder có thể phát sinh MIME này
  private readonly audioMimeTypes = [
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/aac',
    'audio/x-m4a',
    'audio/3gpp',
    'audio/opus',
    'video/webm',
  ];

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private messages: MessagesService,
  ) {}

  /**
   * Create a voice message
   * Voice file should be uploaded first to R2/S3 (presign flow) hoặc qua multipart
   */
  async createVoiceMessage(data: {
    conversationId: string;
    senderId: string;
    fileId: string;
    duration: number;
    waveform?: number[];
    originalFilename?: string;
  }) {
    const file = await this.prisma.fileObject.findUnique({
      where: { id: data.fileId },
    });
    if (!file) throw new NotFoundException('File not found');
    if (!this.audioMimeTypes.includes(file.mime)) {
      throw new BadRequestException('Invalid audio file type');
    }

    const message = await this.messages.send(data.senderId, {
      conversationId: data.conversationId,
      type: MessageTypeDto.VOICE_MESSAGE,
      content: '🎤 Voice Message',
      attachments: [{ fileId: data.fileId }],
      metadata: {
        duration: Math.max(0, data.duration ?? 0),
        waveform: data.waveform || [],
        filename:
          data.originalFilename ||
          file.key?.split('/').pop() ||
          'voice-message',
        fileId: data.fileId,
      },
    });

    // Lấy lại message + file
    const raw = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: {
        attachment: {
          include: { file: true },
        },
      },
    });

    // Gắn URL công khai cho file đính kèm
    return {
      ...raw,
      attachment:
        raw?.attachment?.map((a) => ({
          ...a,
          file: this.files.attachPublicUrl(a.file),
        })) ?? [],
    };
  }

  /**
   * Get voice messages in a conversation
   */
  async getVoiceMessages(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Unauthorized');

    const rows = await this.prisma.message.findMany({
      where: { conversationId, type: 'VOICE_MESSAGE', deletedAt: null },
      include: { attachment: { include: { file: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Gắn URL công khai
    return rows.map((m) => ({
      ...m,
      attachment: m.attachment.map((a) => ({
        ...a,
        file: this.files.attachPublicUrl(a.file),
      })),
    }));
  }

  /**
   * (demo) Generate waveform from audio buffer
   * Production: decode -> extract PCM -> peaks -> normalize
   */
  generateWaveform(_audioBuffer: Buffer, samples = 50): number[] {
    const arr: number[] = [];
    for (let i = 0; i < samples; i++) arr.push(Math.random());
    return arr;
  }

  /**
   * Multipart upload → R2 → create message
   */
  async uploadVoiceMessage(params: {
    conversationId: string;
    senderId: string;
    file: Express.Multer.File;
    duration?: number;
    waveform?: number[];
  }) {
    const { conversationId, senderId, file, duration, waveform } = params;
    if (!file) throw new BadRequestException('No audio file provided');

    // Validate + upload buffer
    const fileObject = await this.files.createFileFromBuffer({
      buffer: file.buffer,
      mime: file.mimetype,
      size: file.size,
      filename: file.originalname || `voice-${Date.now()}`,
      keyPrefix: 'voice',
      allowedMimes: this.audioMimeTypes,
    });

    return this.createVoiceMessage({
      conversationId,
      senderId,
      fileId: fileObject.id,
      duration: duration ?? 0,
      waveform,
      originalFilename: file.originalname,
    });
  }
}
