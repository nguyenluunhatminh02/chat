import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum MessageTypeDto {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
}

export class SendMessageDto {
  @IsString() conversationId: string;
  @IsEnum(MessageTypeDto) type: MessageTypeDto = MessageTypeDto.TEXT;
  @IsOptional() @IsString() content?: string | null;
  @IsOptional() @IsString() parentId?: string; // reply
  @IsOptional() attachments?: { fileId: string }[];
}
