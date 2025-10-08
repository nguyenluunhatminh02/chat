import { Module } from '@nestjs/common';
import { ForwardingController } from './forwarding.controller';
import { ForwardingService } from './forwarding.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ForwardingController],
  providers: [ForwardingService],
  exports: [ForwardingService],
})
export class ForwardingModule {}
