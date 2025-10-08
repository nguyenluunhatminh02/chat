import { Module } from '@nestjs/common';
import { UserPresenceController } from './user-presence.controller';
import { UserPresenceService } from './user-presence.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserPresenceController],
  providers: [UserPresenceService],
  exports: [UserPresenceService],
})
export class UserPresenceModule {}
