import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { ScheduleMessageDto } from './dto/schedule-message.dto';

// @UseGuards(JwtAuthGuard)
@Controller('scheduled-messages')
export class ScheduledMessagesController {
  constructor(private scheduledMessagesService: ScheduledMessagesService) {}

  @Post()
  async scheduleMessage(
    @UserId() userId: string,
    @Body() body: ScheduleMessageDto,
  ) {
    return this.scheduledMessagesService.scheduleMessage({
      ...body,
      senderId: userId,
      scheduledFor: new Date(body.scheduledFor),
    });
  }

  @Get('user')
  async getUserScheduledMessages(@UserId() userId: string) {
    return this.scheduledMessagesService.getUserScheduledMessages(userId);
  }

  @Get('conversation/:conversationId')
  async getConversationScheduledMessages(
    @UserId() userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.scheduledMessagesService.getConversationScheduledMessages(
      conversationId,
      userId,
    );
  }

  @Put(':id')
  async updateScheduledMessage(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body()
    body: {
      content?: string;
      scheduledFor?: string;
      metadata?: any;
    },
  ) {
    return this.scheduledMessagesService.updateScheduledMessage(id, userId, {
      ...body,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });
  }

  @Delete(':id')
  async cancelScheduledMessage(
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.scheduledMessagesService.cancelScheduledMessage(id, userId);
  }
}
