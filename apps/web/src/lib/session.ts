const KEY = 'booking.session';

export interface BookingSession {
  reservationId: string;
  accessToken: string;
  roomId: number;
  paymentId: string | null;
}

// The secure code is deliberately never part of the session: it is shown once and only kept in memory
export function saveSession(session: BookingSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: the guest will simply be asked for the code again
  }
}

export function loadSession(): BookingSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BookingSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: there was nothing stored to remove
  }
}
