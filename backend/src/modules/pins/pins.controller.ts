import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PinsService } from './pins.service';
import { UserId } from 'src/common/decorators/user-id.decorator';

@Controller('pins')
export class PinsController {
  constructor(private pins: PinsService) {}

  @Post()
  add(@UserId() userId: string, @Body('messageId') messageId: string) {
    return this.pins.add(userId, messageId);
  }

  @Delete(':messageId')
  remove(@UserId() userId: string, @Param('messageId') messageId: string) {
    return this.pins.remove(userId, messageId);
  }

  @Get(':conversationId')
  list(
    @Param('conversationId') conversationId: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.pins.list(conversationId, limit, cursor);
  }
}
