import { IsString, Matches } from 'class-validator';

export class ToggleReactionDto {
  @IsString() messageId: string;

  // Cho đơn giản: chấp nhận emoji unicode hoặc short name
  @IsString()
  @Matches(/^.{1,32}$/) // tránh quá dài
  emoji: string;
}
