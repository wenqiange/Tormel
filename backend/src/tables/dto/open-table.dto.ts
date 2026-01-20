import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OpenTableDto {
  @ApiPropertyOptional({ default: 1, description: 'Number of guests' })
  @IsInt()
  @Min(1)
  @IsOptional()
  guestCount?: number;

  @ApiPropertyOptional({ description: 'Guest name or reservation name' })
  @IsString()
  @IsOptional()
  guestName?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
