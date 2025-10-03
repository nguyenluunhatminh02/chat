import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignDto } from './dto/presign.dto';
import { CompleteDto } from './dto/complete.dto';
import { ThumbnailDto } from './dto/thumbnail.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  /**
   * ✅ Dùng cho Cloudflare R2 (khuyên dùng)
   */
  @Post('presign-put')
  presignPut(@Body() dto: PresignDto) {
    return this.svc.presignPut(dto.filename, dto.mime, dto.sizeMax);
  }

  /**
   * (Giữ cho S3/MinIO). Nếu endpoint là R2 → sẽ báo lỗi rõ ràng.
   */
  @Post('presign')
  presign(@Body() dto: PresignDto) {
    return this.svc.presign(dto.filename, dto.mime, dto.sizeMax);
  }

  @Post('complete')
  complete(@Body() dto: CompleteDto) {
    return this.svc.complete(dto.fileId);
  }

  // tải private bằng presigned GET
  @Get('presign-get')
  presignGet(
    @Query('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    return this.svc.presignGet(key, expiresIn ? Number(expiresIn) : 600);
  }

  // tạo thumbnail
  @Post('thumbnail')
  thumbnail(@Body() dto: ThumbnailDto) {
    return this.svc.createThumbnail(dto.fileId, dto.maxSize ?? 512);
  }

  // xoá file (force=1 để xoá cả khi đang gắn với message)
  @Delete(':fileId')
  remove(@Param('fileId') fileId: string, @Query('force') force?: string) {
    return this.svc.deleteFile(fileId, force === '1' || force === 'true');
  }
}
