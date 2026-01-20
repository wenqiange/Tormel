import { IsNumber, IsBoolean, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyDiscountDto {
  @ApiProperty({ description: 'Discount amount (or percentage if isPercentage=true)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ default: false, description: 'If true, amount is treated as percentage' })
  @IsBoolean()
  @IsOptional()
  isPercentage?: boolean = false;

  @ApiPropertyOptional({ description: 'Reason for discount' })
  @IsString()
  @IsOptional()
  reason?: string;
}
