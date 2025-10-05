import { Module } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { ReactionsController } from './reactions.controller';
import { MessagingGateway } from 'src/websockets/messaging.gateway';
import { PresenceService } from '../presence/presence.service';
import { BlocksService } from '../blocks/blocks.service';

@Module({
  providers: [
    ReactionsService,
    MessagingGateway,
    PresenceService,
    BlocksService,
  ],
  controllers: [ReactionsController],
})
export class ReactionsModule {}
