import { Injectable, UnprocessableEntityException, type PipeTransform } from '@nestjs/common';

const RESERVATION_ID = /^RES-[0-9A-HJKMNP-TV-Z]{6}$/;

@Injectable()
export class ReservationIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!RESERVATION_ID.test(value)) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: [{ field: 'reservationId', code: 'INVALID_FORMAT' }],
      });
    }
    return value;
  }
}
