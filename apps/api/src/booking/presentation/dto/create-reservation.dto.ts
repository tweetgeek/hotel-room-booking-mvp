import { Transform } from 'class-transformer';
import { IsDefined, IsEmail, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsCalendarDate } from './validators';

export class CreateReservationDto {
  @IsInt({ message: 'INVALID_FORMAT' })
  @Min(1, { message: 'INVALID_FORMAT' })
  roomId!: number;

  @IsDefined({ message: 'REQUIRED' })
  @IsCalendarDate()
  checkIn!: string;

  @IsDefined({ message: 'REQUIRED' })
  @IsCalendarDate()
  checkOut!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'REQUIRED' })
  @MinLength(1, { message: 'REQUIRED' })
  @MaxLength(100, { message: 'TOO_LONG' })
  guestName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'INVALID_EMAIL' })
  guestEmail!: string;
}
