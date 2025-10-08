import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { ForwardingService } from './forwarding.service';
import { normalizeId } from 'src/common/utils/normalize-id';

// @UseGuards(JwtAuthGuard)
@Controller('forwarding')
export class ForwardingController {
  constructor(private forwardingService: ForwardingService) {}

  @Post('forward')
  async forwardMessage(
    @Body()
    body: {
      messageId: string;
      targetConversationIds: string[];
      includeAttribution?: boolean;
      atomic?: boolean;
    },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    console.log('userId in forwarding controller:', userId);

    return this.forwardingService.forwardMessage({
      ...body,
      userId: normalizeId(userId),
    });
  }

  @Post('forward-multiple')
  async forwardMultipleMessages(
    @Body()
    body: {
      messageIds: string[];
      targetConversationId: string;
      includeAttribution?: boolean;
      atomicPerMessage?: boolean;
    },
    @Request() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.forwardingService.forwardMultipleMessages({
      ...body,
      userId: normalizeId(userId),
    });
  }

  @Get('info/:messageId')
  async getForwardingInfo(@Param('messageId') messageId: string) {
    return this.forwardingService.getForwardingInfo(messageId);
  }
}
