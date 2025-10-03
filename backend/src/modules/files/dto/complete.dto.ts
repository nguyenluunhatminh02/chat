import { IsString } from 'class-validator';

export class CompleteDto {
  @IsString()
  fileId: string;
}
