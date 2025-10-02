import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
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
  ) {
    return this.svc.list(cid, cursor, Number(limit));
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

  // ====== NEW: Soft delete ======
  @Delete(':id')
  delete(@UserId() userId: string, @Param('id') id: string) {
    return this.svc.softDelete(userId, id);
  }
}
