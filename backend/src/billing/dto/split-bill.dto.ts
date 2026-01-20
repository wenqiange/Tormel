import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SplitBillDto {
  @ApiProperty({ description: 'Bill item IDs to move to new split bill' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  billItemIds: string[];
}
