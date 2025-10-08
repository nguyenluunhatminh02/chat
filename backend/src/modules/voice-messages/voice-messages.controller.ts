import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  // UseGuards,
} from '@nestjs/common';
import { VoiceMessagesService } from './voice-messages.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { UserId } from '../../common/decorators/user-id.decorator';

// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // nếu có guard sẵn, mở ra

// @UseGuards(JwtAuthGuard)
@Controller('voice-messages')
export class VoiceMessagesController {
  constructor(private voiceMessagesService: VoiceMessagesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (_req, file, cb) => {
        // MediaRecorder đôi khi ra video/webm cho audio-only
        const allowed = new Set([
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
        ]);
        cb(
          allowed.has(file.mimetype)
            ? null
            : new Error('Unsupported audio mime'),
          allowed.has(file.mimetype),
        );
      },
    }),
  )
  async createVoiceMessage(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      conversationId: string;
      fileId?: string;
      duration?: number | string;
      waveform?: number[] | string;
      originalFilename?: string; // optional cho presign flow
    },
    @UserId() senderId: string,
  ) {
    const { conversationId } = body;
    if (!conversationId) {
      throw new BadRequestException('conversationId is required');
    }

    const parsedDuration = Number(body.duration ?? 0);
    const duration = Number.isFinite(parsedDuration) ? parsedDuration : 0;

    let waveform: number[] | undefined = undefined;
    if (body.waveform) {
      if (Array.isArray(body.waveform)) {
        waveform = body.waveform.map((v) => Number(v) || 0);
      } else if (typeof body.waveform === 'string') {
        try {
          const parsed = JSON.parse(body.waveform);
          if (Array.isArray(parsed)) {
            waveform = parsed.map((v) => Number(v) || 0);
          } else {
            throw new Error('waveform must be an array');
          }
        } catch {
          throw new BadRequestException('waveform must be an array of numbers');
        }
      }
    }

    // Flow A: multipart upload trực tiếp
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        throw new BadRequestException('Audio file too large (max 20MB)');
      }
      return this.voiceMessagesService.uploadVoiceMessage({
        conversationId,
        senderId,
        file,
        duration,
        waveform,
      });
    }

    // Flow B: presign PUT/POST + /files/complete => gửi fileId
    if (!body.fileId) {
      throw new BadRequestException('file or fileId is required');
    }

    return this.voiceMessagesService.createVoiceMessage({
      conversationId,
      senderId,
      fileId: body.fileId,
      duration,
      waveform,
      originalFilename: body.originalFilename,
    });
  }

  @Get('conversation/:conversationId')
  async getVoiceMessages(
    @Param('conversationId') conversationId: string,
    @UserId() userId: string,
  ) {
    return this.voiceMessagesService.getVoiceMessages(
      String(conversationId),
      userId,
    );
  }
}
