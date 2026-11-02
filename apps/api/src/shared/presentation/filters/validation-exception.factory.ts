import { UnprocessableEntityException, ValidationPipe, type ValidationError } from '@nestjs/common';

export interface ValidationDetail {
  field: string;
  code: string;
}

/**
 * DTO decorators carry the field code as their message (REQUIRED, TOO_LONG, INVALID_EMAIL, …);
 * the UI maps `field` + `code` to Polish text (ADR-009).
 */
export function collectValidationDetails(errors: ValidationError[], parent = ''): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((code) => ({ field, code }));
    const nested = error.children?.length ? collectValidationDetails(error.children, field) : [];
    return [...own, ...nested];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed.',
    details: collectValidationDetails(errors),
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: validationExceptionFactory,
  });
}
