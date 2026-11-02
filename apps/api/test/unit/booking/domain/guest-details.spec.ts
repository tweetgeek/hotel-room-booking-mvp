import { GuestDetails } from '../../../../src/booking/domain/guest-details';

describe('GuestDetails', () => {
  it('trims the name and keeps a valid e-mail', () => {
    const guest = GuestDetails.create('  Anna Kowalska ', 'anna@example.com');
    expect(guest.name).toBe('Anna Kowalska');
    expect(guest.email).toBe('anna@example.com');
  });

  it('requires a name of 1 to 100 characters after trimming', () => {
    expect(() => GuestDetails.create('   ', 'anna@example.com')).toThrow(
      expect.objectContaining({ extras: { details: [{ field: 'guestName', code: 'REQUIRED' }] } }),
    );
    expect(() => GuestDetails.create('a'.repeat(101), 'anna@example.com')).toThrow(
      expect.objectContaining({ extras: { details: [{ field: 'guestName', code: 'TOO_LONG' }] } }),
    );
    expect(GuestDetails.create('a'.repeat(100), 'anna@example.com').name).toHaveLength(100);
  });

  it('requires an e-mail with a local part, @ and a domain', () => {
    for (const bad of ['', 'anna', 'anna@', '@example.com', 'anna@example', 'an na@example.com']) {
      expect(() => GuestDetails.create('Anna', bad)).toThrow(
        expect.objectContaining({ extras: { details: [{ field: 'guestEmail', code: 'INVALID_EMAIL' }] } }),
      );
    }
  });
});
