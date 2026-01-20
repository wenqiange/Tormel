import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinLoginDto {
  @ApiProperty({ example: '1234', description: 'User PIN for quick login' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  pin: string;
}
