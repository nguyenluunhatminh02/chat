import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('reactions')
export class ReactionsController {
  constructor(private svc: ReactionsService) {}

  @Post('toggle')
  toggle(@UserId() userId: string, @Body() dto: ToggleReactionDto) {
    return this.svc.toggle(userId, dto);
  }

  @Get(':messageId')
  list(@Param('messageId') messageId: string) {
    return this.svc.list(messageId);
  }
}
