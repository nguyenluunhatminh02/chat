import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseFilePipeBuilder } from '@nestjs/common';
import * as multer from 'multer';
import type { Express } from 'express';

import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { WorkspaceId } from '../../common/decorators/workspace-id.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('conversations')
@UseGuards(WorkspaceGuard)
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Post()
  create(
    @UserId() userId: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.svc.create(userId, dto, workspaceId);
  }

  @Get()
  list(@UserId() userId: string, @WorkspaceId() workspaceId: string) {
    return this.svc.listForUser(userId, workspaceId);
  }

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: multer.memoryStorage(), // ⬅️ cần để có file.buffer
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          const error = new BadRequestException('Only image files are allowed');
          return cb(error as unknown as Error, false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Param('id') conversationId: string,
    @UploadedFile(
      // thêm xác thực kiểu & size một lần nữa ở layer pipe
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: 400 }),
    )
    file: Express.Multer.File,
    @UserId() userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.uploadAvatar(conversationId, userId, file);
  }

  @Get(':id/avatar-url')
  getAvatarUrl(@Param('id') conversationId: string) {
    // presigned GET 10 phút (service mặc định 600s)
    return this.svc.getAvatarUrl(conversationId);
  }

  @Delete(':id/avatar')
  clearAvatar(@Param('id') conversationId: string, @UserId() userId: string) {
    return this.svc.clearAvatar(conversationId, userId);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') conversationId: string,
    @Param('memberId') memberId: string,
    @UserId() userId: string,
  ) {
    return this.svc.removeMember(conversationId, userId, memberId);
  }

  @Post(':id/members')
  addMember(
    @Param('id') conversationId: string,
    @Body('userId') newMemberId: string,
    @UserId() userId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.svc.addMember(conversationId, userId, newMemberId, workspaceId);
  }
}
