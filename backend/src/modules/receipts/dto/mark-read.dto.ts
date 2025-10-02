import { IsString } from 'class-validator';

export class MarkReadDto {
  @IsString() conversationId: string;
  @IsString() messageId: string;
}
