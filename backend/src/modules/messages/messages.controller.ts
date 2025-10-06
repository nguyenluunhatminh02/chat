import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { MessageTypeDto, SendMessageDto } from './dto/send-message.dto';
import { UserId } from '../../common/decorators/user-id.decorator';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Get(':conversationId')
  list(
    @Param('conversationId') cid: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 30,
    @Query('includeDeleted') includeDeleted = '1',
  ) {
    const inc = includeDeleted === '1' || includeDeleted === 'true';
    return this.svc.list(cid, cursor, Number(limit), inc);
  }

  @Post()
  send(@UserId() userId: string, @Body() dto: SendMessageDto) {
    return this.svc.send(userId, dto);
  }

  // ====== NEW: Edit ======
  @Patch(':id')
  edit(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.svc.edit(userId, id, dto);
  }

  @Get('thread/:parentId')
  thread(
    @Param('parentId') parentId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 30,
  ) {
    // trả theo thời gian tăng dần để hiển thị tự nhiên
    return this.svc.thread(parentId, cursor, Number(limit));
  }

  // ====== NEW: Soft delete ======
  @Delete(':id')
  delete(@UserId() userId: string, @Param('id') id: string) {
    return this.svc.softDelete(userId, id);
  }

  @Get('around/:messageId')
  around(
    @UserId() userId: string,
    @Param('messageId') messageId: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    const b = before ? Number(before) : 20;
    const a = after ? Number(after) : 20;
    return this.svc.around(userId, messageId, b, a);
  }

  // ====== NEW: Paste image upload (PHẦN 30) ======
  @Post(':conversationId/paste-image')
  @UseInterceptors(FileInterceptor('file'))
  async pasteImage(
    @UserId() userId: string,
    @Param('conversationId') cid: string,
    @UploadedFile() file: any,
  ) {
    // 1) validate nhẹ
    if (!file) throw new BadRequestException('No file');
    if (!file.mimetype.startsWith('image/'))
      throw new BadRequestException('Only image allowed');
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('Image too large');

    // 2) dùng FilesService lưu vào R2 → nhận fileObject
    const f = await this.svc.savePasteImageToR2(
      file as { mimetype: string; buffer: Buffer; size: number },
    );

    // 3) tạo message type=IMAGE + attachment
    return this.svc.send(userId, {
      conversationId: cid,
      type: MessageTypeDto.IMAGE,
      content: null,
      attachments: [{ fileId: f.id }],
    });
  }
}
