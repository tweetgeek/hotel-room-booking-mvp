import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReservationStore } from '../../src/stores/reservation.store';
import { useRoomStore } from '../../src/stores/room.store';
import * as reservationsApi from '../../src/api/reservations';
import type { ReservationDetails } from '../../src/api/reservations';
import * as paymentApi from '../../src/api/payment-operator';
import { ApiError } from '../../src/api/client';
import { pl } from '../../src/i18n/pl';

vi.mock('../../src/api/reservations', () => ({
  createReservation: vi.fn(),
  fetchReservationStatus: vi.fn(),
  fetchReservationDetails: vi.fn(),
  verifySecureCode: vi.fn(),
  cancelReservation: vi.fn(),
}));
vi.mock('../../src/api/payment-operator', () => ({
  fetchPayment: vi.fn(),
  decidePayment: vi.fn(),
}));

const draft = {
  roomId: 1,
  checkIn: '2026-11-10',
  checkOut: '2026-11-13',
  nights: 3,
  totalAmount: 96000,
  currency: 'PLN',
  guestName: 'Anna Kowalska',
  guestEmail: 'anna@example.com',
};

const created = {
  reservationId: 'RES-7F3K2A',
  paymentId: 'PAY-9Q2M4H7ZXT',
  secureCode: 'aBc7xY',
  accessToken: 'token-1',
  status: 'PendingPayment' as const,
  totalAmount: 96000,
  currency: 'PLN',
  nights: 3,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useReservationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.mocked(reservationsApi.createReservation).mockReset();
    vi.mocked(reservationsApi.fetchReservationStatus).mockReset();
    vi.mocked(reservationsApi.fetchReservationDetails).mockReset();
    vi.mocked(paymentApi.decidePayment).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  describe('create', () => {
    it('shows the pending reservation and holds the nights before the server answers', async () => {
      const pending = deferred<typeof created>();
      vi.mocked(reservationsApi.createReservation).mockReturnValue(pending.promise);
      const store = useReservationStore();
      const rooms = useRoomStore();

      const creating = store.create(draft);

      expect(store.current).toMatchObject({ id: null, status: 'PendingPayment', optimistic: true });
      expect(store.draft).toEqual(draft);
      expect(rooms.isNightBlocked(1, '2026-11-12')).toBe(true);

      pending.resolve(created);
      expect(await creating).toBe(true);
      expect(store.current).toMatchObject({
        id: 'RES-7F3K2A',
        paymentId: 'PAY-9Q2M4H7ZXT',
        secureCode: 'aBc7xY',
        accessToken: 'token-1',
        optimistic: false,
      });
      const session = JSON.parse(sessionStorage.getItem('booking.session') ?? '{}');
      expect(session).toEqual({
        reservationId: 'RES-7F3K2A',
        accessToken: 'token-1',
        roomId: 1,
        paymentId: 'PAY-9Q2M4H7ZXT',
      });
      expect(sessionStorage.getItem('booking.session')).not.toContain('aBc7xY');
    });

    it('rolls back on 409, releases the nights and keeps the server code as the message', async () => {
      vi.mocked(reservationsApi.createReservation).mockRejectedValue(
        new ApiError(409, 'ROOM_NOT_AVAILABLE', 'At least one requested night is already blocked.'),
      );
      const store = useReservationStore();
      const rooms = useRoomStore();

      expect(await store.create(draft)).toBe(false);

      expect(store.current).toBeNull();
      expect(store.pendingDecision).toBeNull();
      expect(rooms.isNightBlocked(1, '2026-11-10')).toBe(false);
      expect(store.error).toBe('ROOM_NOT_AVAILABLE');
      expect(store.errorMessage).toBe(pl.errors.ROOM_NOT_AVAILABLE);
      expect(sessionStorage.getItem('booking.session')).toBeNull();
    });

    it('rolls back on a network error too', async () => {
      vi.mocked(reservationsApi.createReservation).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));
      const store = useReservationStore();
      expect(await store.create(draft)).toBe(false);
      expect(store.error).toBe('NETWORK_ERROR');
    });
  });

  describe('decide', () => {
    it('queues a decision clicked before the paymentId arrives and sends it right after', async () => {
      const pending = deferred<typeof created>();
      vi.mocked(reservationsApi.createReservation).mockReturnValue(pending.promise);
      vi.mocked(paymentApi.decidePayment).mockResolvedValue({
        paymentId: 'PAY-9Q2M4H7ZXT',
        outcome: 'paid',
        scheduledInSeconds: 3,
      });
      const store = useReservationStore();
      const creating = store.create(draft);

      const deciding = store.decide('paid', 3);
      expect(store.pendingDecision).toEqual({ outcome: 'paid', delaySeconds: 3 });
      expect(paymentApi.decidePayment).not.toHaveBeenCalled();

      pending.resolve(created);
      await creating;
      expect(await deciding).toBe(true);
      expect(paymentApi.decidePayment).toHaveBeenCalledWith('PAY-9Q2M4H7ZXT', 'paid', 3);
      expect(store.pendingDecision).toBeNull();
    });

    it('drops the queued decision when the creation fails', async () => {
      const pending = deferred<typeof created>();
      vi.mocked(reservationsApi.createReservation).mockReturnValue(pending.promise);
      const store = useReservationStore();
      const creating = store.create(draft);
      const deciding = store.decide('paid', 0);

      pending.reject(new ApiError(409, 'ROOM_NOT_AVAILABLE', 'x'));
      await creating;

      expect(await deciding).toBe(false);
      expect(store.pendingDecision).toBeNull();
      expect(paymentApi.decidePayment).not.toHaveBeenCalled();
    });

    it('records RESERVATION_NOT_PENDING on 409 without clearing the reservation', async () => {
      vi.mocked(reservationsApi.createReservation).mockResolvedValue(created);
      vi.mocked(paymentApi.decidePayment).mockRejectedValue(
        new ApiError(409, 'RESERVATION_NOT_PENDING', 'x'),
      );
      const store = useReservationStore();
      await store.create(draft);

      expect(await store.decide('paid', 0)).toBe(false);

      expect(store.error).toBe('RESERVATION_NOT_PENDING');
      expect(store.current?.id).toBe('RES-7F3K2A');
    });
  });

  describe('status polling', () => {
    it('polls every 2 s until the status leaves PendingPayment, then loads the details', async () => {
      vi.useFakeTimers();
      vi.mocked(reservationsApi.createReservation).mockResolvedValue(created);
      vi.mocked(reservationsApi.fetchReservationStatus)
        .mockResolvedValueOnce({ reservationId: 'RES-7F3K2A', status: 'PendingPayment', reason: null })
        .mockResolvedValueOnce({ reservationId: 'RES-7F3K2A', status: 'Confirmed', reason: null });
      vi.mocked(reservationsApi.fetchReservationDetails).mockResolvedValue({
        reservationId: 'RES-7F3K2A',
        status: 'Confirmed',
        room: { id: 1, name: 'Pokój', checkInTime: '15:00', checkOutTime: '11:00' },
        checkIn: '2026-11-10',
        checkOut: '2026-11-13',
        nights: 3,
        guestName: 'Anna Kowalska',
        guestEmail: 'anna@example.com',
        totalAmount: 96000,
        currency: 'PLN',
        reason: null,
        refundAmount: null,
        cancellable: true,
        timeline: [],
      });
      const store = useReservationStore();
      await store.create(draft);

      store.pollStatus();
      await vi.advanceTimersByTimeAsync(2000);
      expect(reservationsApi.fetchReservationStatus).toHaveBeenCalledTimes(1);
      expect(store.current?.status).toBe('PendingPayment');

      await vi.advanceTimersByTimeAsync(2000);
      expect(store.current?.status).toBe('Confirmed');
      expect(reservationsApi.fetchReservationDetails).toHaveBeenCalledWith('RES-7F3K2A', 'token-1');
      expect(store.current?.details?.cancellable).toBe(true);

      await vi.advanceTimersByTimeAsync(6000);
      expect(reservationsApi.fetchReservationStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('session', () => {
    it('restores id, token and payment id from the session but never a secure code', () => {
      sessionStorage.setItem(
        'booking.session',
        JSON.stringify({
          reservationId: 'RES-7F3K2A',
          accessToken: 'token-1',
          roomId: 1,
          paymentId: 'PAY-9Q2M4H7ZXT',
        }),
      );
      const store = useReservationStore();

      expect(store.restoreFromSession()).toBe(true);
      expect(store.current).toMatchObject({
        id: 'RES-7F3K2A',
        accessToken: 'token-1',
        paymentId: 'PAY-9Q2M4H7ZXT',
        secureCode: null,
      });
      expect(store.roomId).toBe(1);
    });

    it('forgets the secure code on demand', async () => {
      vi.mocked(reservationsApi.createReservation).mockResolvedValue(created);
      const store = useReservationStore();
      await store.create(draft);
      store.forgetSecureCode();
      expect(store.current?.secureCode).toBeNull();
    });
  });
});

describe('useReservationStore (secure code and cancellation)', () => {
  const details: ReservationDetails = {
    reservationId: 'RES-7F3K2A',
    status: 'Confirmed' as const,
    room: { id: 1, name: 'Pokój', checkInTime: '15:00', checkOutTime: '11:00' },
    checkIn: '2026-11-10',
    checkOut: '2026-11-13',
    nights: 3,
    guestName: 'Anna Kowalska',
    guestEmail: 'anna@example.com',
    totalAmount: 96000,
    currency: 'PLN',
    reason: null,
    refundAmount: null,
    cancellable: true,
    timeline: [
      { eventType: 'ReservationRequested' as const, occurredAt: '2026-11-03T10:00:00.000Z', reason: null },
    ],
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.mocked(reservationsApi.verifySecureCode).mockReset();
    vi.mocked(reservationsApi.cancelReservation).mockReset();
    vi.mocked(reservationsApi.fetchReservationDetails).mockReset();
  });

  it('unlock stores the token in memory and session and loads the details', async () => {
    vi.mocked(reservationsApi.verifySecureCode).mockResolvedValue({
      accessToken: 'token-2',
      expiresInSeconds: 900,
    });
    vi.mocked(reservationsApi.fetchReservationDetails).mockResolvedValue(details);
    const store = useReservationStore();
    store.openPermalink('RES-7F3K2A');

    expect(await store.unlock('abcxyz')).toBe(true);

    expect(reservationsApi.verifySecureCode).toHaveBeenCalledWith('RES-7F3K2A', 'abcxyz');
    expect(store.current?.accessToken).toBe('token-2');
    expect(store.current?.details?.guestName).toBe('Anna Kowalska');
    expect(JSON.parse(sessionStorage.getItem('booking.session') ?? '{}')).toMatchObject({
      reservationId: 'RES-7F3K2A',
      accessToken: 'token-2',
    });
  });

  it('unlock keeps attemptsLeft on 401 and retryAfterSeconds on 429 without a token', async () => {
    const store = useReservationStore();
    store.openPermalink('RES-7F3K2A');

    vi.mocked(reservationsApi.verifySecureCode).mockRejectedValueOnce(
      new ApiError(401, 'INVALID_SECURE_CODE', 'x', [], 3),
    );
    expect(await store.unlock('wrong1')).toBe(false);
    expect(store.error).toBe('INVALID_SECURE_CODE');
    expect(store.attemptsLeft).toBe(3);
    expect(store.current?.accessToken).toBeNull();

    vi.mocked(reservationsApi.verifySecureCode).mockRejectedValueOnce(
      new ApiError(429, 'TOO_MANY_ATTEMPTS', 'x', [], undefined, 540),
    );
    expect(await store.unlock('wrong1')).toBe(false);
    expect(store.error).toBe('TOO_MANY_ATTEMPTS');
    expect(store.retryAfterSeconds).toBe(540);
  });

  async function unlockedStore() {
    vi.mocked(reservationsApi.verifySecureCode).mockResolvedValue({
      accessToken: 'token-2',
      expiresInSeconds: 900,
    });
    vi.mocked(reservationsApi.fetchReservationDetails).mockResolvedValue(details);
    const store = useReservationStore();
    store.openPermalink('RES-7F3K2A');
    await store.unlock('abcxyz');
    return store;
  }

  it('cancel shows the cancellation immediately, then keeps the server details', async () => {
    const store = await unlockedStore();
    const pending = deferred<ReservationDetails>();
    vi.mocked(reservationsApi.cancelReservation).mockReturnValue(pending.promise);
    const rooms = useRoomStore();
    rooms.holdNightsLocally(1, ['2026-11-10', '2026-11-11', '2026-11-12']);

    const cancelling = store.cancel();

    expect(store.current?.details?.status).toBe('Cancelled');
    expect(store.current?.details?.cancellable).toBe(false);
    expect(store.current?.details?.timeline.at(-1)?.eventType).toBe('ReservationCancelled');
    expect(rooms.isNightBlocked(1, '2026-11-11')).toBe(false);

    const fromServer = { ...details, status: 'Cancelled' as const, cancellable: false, refundAmount: 96000 };
    pending.resolve(fromServer);
    expect(await cancelling).toBe(true);
    expect(store.current?.details).toEqual(fromServer);
    expect(reservationsApi.cancelReservation).toHaveBeenCalledWith('RES-7F3K2A', 'token-2');
  });

  it('cancel rolls back to the previous details with a message on 422', async () => {
    const store = await unlockedStore();
    vi.mocked(reservationsApi.cancelReservation).mockRejectedValue(
      new ApiError(422, 'RESERVATION_NOT_CANCELLABLE', 'x'),
    );

    expect(await store.cancel()).toBe(false);

    expect(store.current?.details).toEqual(details);
    expect(store.current?.status).toBe('Confirmed');
    expect(store.error).toBe('RESERVATION_NOT_CANCELLABLE');
    expect(store.errorMessage).toBe(pl.errors.RESERVATION_NOT_CANCELLABLE);
  });

  it('cancel retries exactly once on a concurrency conflict', async () => {
    const store = await unlockedStore();
    const fromServer = { ...details, status: 'Cancelled' as const, cancellable: false, refundAmount: 96000 };
    vi.mocked(reservationsApi.cancelReservation)
      .mockRejectedValueOnce(new ApiError(409, 'CONCURRENCY_CONFLICT', 'x'))
      .mockResolvedValueOnce(fromServer);

    expect(await store.cancel()).toBe(true);
    expect(reservationsApi.cancelReservation).toHaveBeenCalledTimes(2);

    vi.mocked(reservationsApi.cancelReservation).mockReset();
    vi.mocked(reservationsApi.cancelReservation).mockRejectedValue(
      new ApiError(409, 'CONCURRENCY_CONFLICT', 'x'),
    );
    store.current!.details = details;
    expect(await store.cancel()).toBe(false);
    expect(reservationsApi.cancelReservation).toHaveBeenCalledTimes(2);
    expect(store.error).toBe('CONCURRENCY_CONFLICT');
  });
});
