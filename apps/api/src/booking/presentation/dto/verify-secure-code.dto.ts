import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class VerifySecureCodeDto {
  // Guests may type the code as shown (abc-xyz); the hyphen is not part of the code
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/-/g, '').trim() : value))
  @IsString({ message: 'REQUIRED' })
  @Matches(/^[A-Za-z0-9]{6}$/, { message: 'INVALID_FORMAT' })
  secureCode!: string;
}
