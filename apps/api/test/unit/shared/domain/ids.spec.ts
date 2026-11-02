import { PaymentId, ReservationId, RoomId } from '../../../../src/shared/domain/ids';
import { DomainError } from '../../../../src/shared/domain/domain-error';

describe('identifiers', () => {
  it('accepts a reservation id of RES- plus six Crockford base32 characters', () => {
    expect(ReservationId.of('RES-7F3K2A').value).toBe('RES-7F3K2A');
  });

  it.each(['RES-7F3K2', 'RES-7F3K2AB', 'RES-7F3K2O', 'res-7f3k2a', '7F3K2A'])(
    'rejects reservation id %p',
    (raw) => {
      expect(() => ReservationId.of(raw)).toThrow(DomainError);
    },
  );

  it('accepts a payment id of PAY- plus ten Crockford base32 characters', () => {
    expect(PaymentId.of('PAY-9Q2M4H7ZXT').value).toBe('PAY-9Q2M4H7ZXT');
    expect(() => PaymentId.of('PAY-9Q2M4H7ZX')).toThrow(DomainError);
  });

  it('accepts a positive integer room id', () => {
    expect(RoomId.of(1).value).toBe(1);
    expect(() => RoomId.of(0)).toThrow(DomainError);
    expect(() => RoomId.of(1.5)).toThrow(DomainError);
  });
});
