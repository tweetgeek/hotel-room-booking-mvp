import { ParseIntPipe, UnprocessableEntityException } from '@nestjs/common';

/** Path ids that fail parsing answer 422 with a field code, like body validation (ADR-009). */
export function intIdParam(field: string): ParseIntPipe {
  return new ParseIntPipe({
    exceptionFactory: () =>
      new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: [{ field, code: 'INVALID_FORMAT' }],
      }),
  });
}
