import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Bebidas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Bebidas frías y calientes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#1890ff' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 'coffee' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Parent category ID for subcategories' })
  @IsString()
  @IsOptional()
  parentId?: string;
}
