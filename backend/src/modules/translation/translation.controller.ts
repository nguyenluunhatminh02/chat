// translation.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { TranslationService } from './translation.service';
import { UserId } from '../../common/decorators/user-id.decorator';

const ALLOWED_LANGS = [
  'en',
  'vi',
  'ja',
  'zh',
  'ko',
  'fr',
  'es',
  'de',
  'ru',
  'ar',
];

class TranslateDto {
  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @IsString()
  @IsIn(ALLOWED_LANGS)
  targetLanguage!: string;
}

class DetectDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

@Controller('translation')
export class TranslationController {
  constructor(private translationService: TranslationService) {}

  @Post('translate')
  @HttpCode(200)
  translateMessage(@UserId() userId: string, @Body() body: TranslateDto) {
    return this.translationService.translateMessage(
      body.messageId,
      body.targetLanguage,
      userId,
    );
  }

  // Lấy các bản dịch đã lưu của 1 message
  @Get('message/:messageId')
  getTranslations(@Param('messageId') messageId: string) {
    return this.translationService.getTranslations(messageId);
  }

  // Detect bằng POST (mặc định)
  @Post('detect')
  async detectLanguage(@Body() body: DetectDto) {
    const language = await this.translationService.detectLanguage(body.text);
    return { language };
  }

  // (Tuỳ chọn) Detect bằng GET cho dễ thử: /translation/detect?text=bonjour
  @Get('detect')
  async detectLanguageGet(@Query('text') text?: string) {
    const language = await this.translationService.detectLanguage(text ?? '');
    return { language };
  }
}
