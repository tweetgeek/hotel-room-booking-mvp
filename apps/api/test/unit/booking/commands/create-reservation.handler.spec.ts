import { commandWorld, createCommand } from './support';
import { RoomNotAvailableError } from '../../../../src/booking/domain/errors';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';
import { SecureCode } from '../../../../src/booking/domain/secure-code';

describe('CreateReservationHandler', () => {
  it('prices the stay with the room price at command time and stores events with night locks in one unit of work', async () => {
    const w = commandWorld();

    const result = await w.createHandler.execute(createCommand());

    expect(result).toMatchObject({
      reservationId: 'RES-000001',
      paymentId: 'PAY-0000000002',
      status: 'PendingPayment',
      totalAmount: 96000,
      currency: 'PLN',
      nights: 3,
    });
    expect(result.secureCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(result.accessToken).toBe(w.access.lastIssuedToken);

    const stored = await w.eventStore.load('RES-000001');
    expect(stored.map((e) => e.event.eventType)).toEqual(['ReservationRequested']);
    const payload = stored[0].event.payload as Record<string, unknown>;
    expect(payload.totalAmount).toBe(96000);
    expect(await SecureCode.fromInput(result.secureCode).matches(payload.secureCodeHash as string)).toBe(
      true,
    );
    expect(stored[0].event.metadata).toEqual({
      correlationId: 'corr-1',
      causationId: 'CreateReservation',
      occurredAt: '2026-11-03T10:00:00.000Z',
    });
    expect(w.locks.heldBy('RES-000001')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(w.publisher.published.map((e) => e.event.eventType)).toEqual(['ReservationRequested']);
  });

  it('uses a later room price only for later reservations (FR-008)', async () => {
    const w = commandWorld();
    const first = await w.createHandler.execute(createCommand());
    w.catalog.setPrice(1, 40000);
    const second = await w.createHandler.execute(
      createCommand({ checkIn: '2026-12-01', checkOut: '2026-12-02' }),
    );
    expect(first.totalAmount).toBe(96000);
    expect(second.totalAmount).toBe(40000);
  });

  it('throws RoomNotAvailableError when a night is locked and stores no event', async () => {
    const w = commandWorld();
    w.locks.seed(1, ['2026-11-12'], 'RES-OTHER1');

    await expect(w.createHandler.execute(createCommand())).rejects.toBeInstanceOf(RoomNotAvailableError);

    expect(await w.eventStore.readAll(0, 10)).toEqual([]);
    expect(w.locks.heldBy('RES-000001')).toEqual([]);
    expect(w.publisher.published).toEqual([]);
  });

  it('throws NotFoundError for an unknown room', async () => {
    const w = commandWorld();
    await expect(w.createHandler.execute(createCommand({ roomId: 9 }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('validates the stay against today in Europe/Warsaw', async () => {
    const w = commandWorld('2026-11-11');
    await expect(w.createHandler.execute(createCommand())).rejects.toMatchObject({ code: 'INVALID_STAY' });
  });
});
