import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Bill ID' })
  @IsString()
  @IsNotEmpty()
  billId: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ description: 'Amount tendered (for cash payments)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amountTendered?: number;

  @ApiPropertyOptional({ description: 'Transaction reference (for card payments)' })
  @IsString()
  @IsOptional()
  transactionRef?: string;

  @ApiPropertyOptional({ description: 'Last 4 digits of card' })
  @IsString()
  @IsOptional()
  cardLastFour?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
