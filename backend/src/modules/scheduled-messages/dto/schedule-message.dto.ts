// schedule-message.dto.ts
import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class ScheduleMessageDto {
  @IsString() @IsNotEmpty() conversationId!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsISO8601() scheduledFor!: string; // FE gửi ISO
  metadata?: any;
}
