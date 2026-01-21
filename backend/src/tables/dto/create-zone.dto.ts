import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateZoneDto {
  @ApiProperty({ example: 'Terraza' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Zona exterior con vistas al jardín' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#1890ff', description: 'Color hex para identificar la zona visualmente' })
  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Color must be a valid hex color' })
  color?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
