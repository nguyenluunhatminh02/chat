import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PresignDto {
  @IsString() filename: string;
  @IsString() mime: string;
  @IsOptional() @IsInt() @Min(1) @Max(50 * 1024 * 1024) sizeMax?: number;
}
