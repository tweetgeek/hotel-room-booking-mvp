import { Injectable, UnprocessableEntityException, type PipeTransform } from '@nestjs/common';

const PAYMENT_ID = /^PAY-[0-9A-HJKMNP-TV-Z]{10}$/;

@Injectable()
export class PaymentIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!PAYMENT_ID.test(value)) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: [{ field: 'paymentId', code: 'INVALID_FORMAT' }],
      });
    }
    return value;
  }
}
