import {
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ConversationTypeDto {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export class CreateConversationDto {
  @IsEnum(ConversationTypeDto) type: ConversationTypeDto;
  @IsOptional() @IsString() title?: string;
  // danh sách userId muốn thêm (không bao gồm creator)
  @IsArray() @ArrayMinSize(1) members: string[];
}
