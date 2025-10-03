import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ThumbnailDto {
  @IsString() fileId: string;
  // Cạnh dài tối đa của thumbnail
  @IsOptional() @IsInt() @Min(64) @Max(2048) maxSize?: number;
}
