import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

interface JsonResponse {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

/**
 * Every DomainError becomes `{ code, message, ...extras }` with the status the error carries.
 * Registered globally (APP_FILTER) so the payment operator simulator shares it (ADR-009).
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const retryAfter = error.extras.retryAfterSeconds;
    if (typeof retryAfter === 'number') {
      response.setHeader('Retry-After', String(retryAfter));
    }
    response.status(error.httpStatus).json({ code: error.code, message: error.message, ...error.extras });
  }
}
