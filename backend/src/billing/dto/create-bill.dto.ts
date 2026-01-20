import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBillDto {
  @ApiProperty({ description: 'Table ID' })
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @ApiPropertyOptional({ description: 'Specific order item IDs to bill (optional, all unbilled if empty)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  orderItemIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
