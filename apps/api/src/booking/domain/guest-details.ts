import { InvalidGuestDetailsError } from './errors/invalid-guest-details.error';

export const MAX_GUEST_NAME_LENGTH = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class GuestDetails {
  private constructor(
    readonly name: string,
    readonly email: string,
  ) {}

  static create(rawName: string, rawEmail: string): GuestDetails {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new InvalidGuestDetailsError('guestName', 'REQUIRED', 'Guest name is required.');
    }
    if (name.length > MAX_GUEST_NAME_LENGTH) {
      throw new InvalidGuestDetailsError(
        'guestName',
        'TOO_LONG',
        `Guest name may have at most ${MAX_GUEST_NAME_LENGTH} characters.`,
      );
    }
    const email = rawEmail.trim();
    if (!EMAIL.test(email)) {
      throw new InvalidGuestDetailsError('guestEmail', 'INVALID_EMAIL', 'Guest e-mail is not valid.');
    }
    return new GuestDetails(name, email);
  }
}
