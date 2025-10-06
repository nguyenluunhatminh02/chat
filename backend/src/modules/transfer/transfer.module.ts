import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { FilesModule } from '../files/files.module';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Module({
  imports: [FilesModule],
  controllers: [TransferController],
  providers: [TransferService, WorkspacesService],
})
export class TransferModule {}
