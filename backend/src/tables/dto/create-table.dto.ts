import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';

export class CreateTableDto {
  @ApiProperty({ description: 'Zone ID where the table belongs' })
  @IsString()
  @IsNotEmpty()
  zoneId: string;

  @ApiProperty({ example: '1', description: 'Table number/identifier' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiPropertyOptional({ example: 'Mesa del rincón' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ default: 4 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  positionX?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  positionY?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @Min(50)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @Min(50)
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ enum: ['rectangle', 'circle', 'square'], default: 'rectangle' })
  @IsString()
  @IsOptional()
  shape?: string;
}
