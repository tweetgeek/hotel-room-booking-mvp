import type { ArgumentsHost } from '@nestjs/common';
import { DomainErrorFilter } from '../../../../src/shared/presentation/filters/domain-error.filter';
import {
  collectValidationDetails,
  validationExceptionFactory,
} from '../../../../src/shared/presentation/filters/validation-exception.factory';
import { RoomNotAvailableError } from '../../../../src/booking/domain/errors/room-not-available.error';
import { TooManyAttemptsError } from '../../../../src/booking/domain/errors/too-many-attempts.error';
import { InvalidSecureCodeError } from '../../../../src/booking/domain/errors/invalid-secure-code.error';
import { InvalidStayError } from '../../../../src/booking/domain/errors/invalid-stay.error';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';

function fakeHost() {
  const headers: Record<string, string> = {};
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { host, response, headers };
}

describe('DomainErrorFilter', () => {
  const filter = new DomainErrorFilter();

  it('answers with the status and code carried by the error', () => {
    const { host, response } = fakeHost();
    filter.catch(new RoomNotAvailableError(), host);
    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ code: 'ROOM_NOT_AVAILABLE', message: expect.any(String) });
  });

  it('adds extras such as attemptsLeft to the body', () => {
    const { host, response } = fakeHost();
    filter.catch(new InvalidSecureCodeError(3), host);
    expect(response.statusCode).toBe(401);
    expect(response.body).toMatchObject({ code: 'INVALID_SECURE_CODE', attemptsLeft: 3 });
  });

  it('sets Retry-After for rate limiting', () => {
    const { host, response, headers } = fakeHost();
    filter.catch(new TooManyAttemptsError(540), host);
    expect(response.statusCode).toBe(429);
    expect(headers['Retry-After']).toBe('540');
    expect(response.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 540 });
  });

  it('exposes stay violations as field details', () => {
    const { host, response } = fakeHost();
    filter.catch(new InvalidStayError('checkOut', 'TOO_MANY_NIGHTS', 'Stay is longer than 30 nights.'), host);
    expect(response.statusCode).toBe(422);
    expect(response.body).toMatchObject({
      code: 'INVALID_STAY',
      details: [{ field: 'checkOut', code: 'TOO_MANY_NIGHTS' }],
    });
  });

  it('uses the same message for every not found resource', () => {
    const { host, response } = fakeHost();
    filter.catch(new NotFoundError('Reservation'), host);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Reservation not found.' });
  });
});

describe('validationExceptionFactory', () => {
  it('turns class-validator constraint messages into field codes', () => {
    const exception = validationExceptionFactory([
      { property: 'guestName', constraints: { maxLength: 'TOO_LONG' }, children: [] },
      { property: 'guestEmail', constraints: { isEmail: 'INVALID_EMAIL' }, children: [] },
    ]);
    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [
        { field: 'guestName', code: 'TOO_LONG' },
        { field: 'guestEmail', code: 'INVALID_EMAIL' },
      ],
    });
  });

  it('flattens nested properties with a dotted path', () => {
    expect(
      collectValidationDetails([
        { property: 'guest', children: [{ property: 'email', constraints: { isEmail: 'INVALID_EMAIL' } }] },
      ]),
    ).toEqual([{ field: 'guest.email', code: 'INVALID_EMAIL' }]);
  });
});
