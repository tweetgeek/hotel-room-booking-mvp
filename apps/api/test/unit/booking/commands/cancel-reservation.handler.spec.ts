import { commandWorld, createCommand } from './support';
import {
  ConfirmPaymentCommand,
  ConfirmPaymentHandler,
} from '../../../../src/booking/application/commands/confirm-payment.command';
import {
  CancelReservationCommand,
  CancelReservationHandler,
} from '../../../../src/booking/application/commands/cancel-reservation.command';
import { ReservationNotCancellableError } from '../../../../src/booking/domain/errors';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';
import { FixedClock } from '../../support/fixed-clock';

async function confirmedWorld(today = '2026-11-03') {
  const w = commandWorld(today);
  const created = await w.createHandler.execute(createCommand());
  await new ConfirmPaymentHandler(w.repository, w.locks, w.clock, w.uow, w.publisher, w.logger).execute(
    new ConfirmPaymentCommand(created.reservationId, created.paymentId, 'corr-2'),
  );
  w.publisher.published.length = 0;
  return { ...w, created };
}

describe('CancelReservationHandler', () => {
  it('appends ReservationCancelled with a full refund, releases the nights and publishes after commit', async () => {
    const w = await confirmedWorld();
    const handler = new CancelReservationHandler(
      w.repository,
      w.locks,
      w.clock,
      w.uow,
      w.publisher,
      w.logger,
    );

    await handler.execute(new CancelReservationCommand(w.created.reservationId, 'corr-3'));

    const stored = await w.eventStore.load(w.created.reservationId);
    expect(stored.map((e) => e.event.eventType)).toEqual([
      'ReservationRequested',
      'PaymentConfirmed',
      'ReservationCancelled',
    ]);
    expect(stored[2].event.payload).toEqual({
      reservationId: w.created.reservationId,
      refundAmount: 96000,
      currency: 'PLN',
    });
    expect(stored[2].event.metadata.causationId).toBe('CancelReservation');
    expect(w.locks.heldBy(w.created.reservationId)).toEqual([]);
    expect(w.publisher.published.map((e) => e.event.eventType)).toEqual(['ReservationCancelled']);
  });

  it('refuses on the check-in day using today from the Clock (Europe/Warsaw) and stores nothing', async () => {
    const w = await confirmedWorld();
    const onCheckInDay = FixedClock.at('2026-11-10T06:00:00.000Z', '2026-11-10');
    const handler = new CancelReservationHandler(
      w.repository,
      w.locks,
      onCheckInDay,
      w.uow,
      w.publisher,
      w.logger,
    );

    await expect(
      handler.execute(new CancelReservationCommand(w.created.reservationId, 'corr-3')),
    ).rejects.toBeInstanceOf(ReservationNotCancellableError);
    expect(await w.eventStore.load(w.created.reservationId)).toHaveLength(2);
    expect(w.locks.heldBy(w.created.reservationId)).toHaveLength(3);
  });

  it('refuses a pending reservation and an unknown one', async () => {
    const w = commandWorld();
    const created = await w.createHandler.execute(createCommand());
    const handler = new CancelReservationHandler(
      w.repository,
      w.locks,
      w.clock,
      w.uow,
      w.publisher,
      w.logger,
    );

    await expect(
      handler.execute(new CancelReservationCommand(created.reservationId, 'c')),
    ).rejects.toBeInstanceOf(ReservationNotCancellableError);
    await expect(handler.execute(new CancelReservationCommand('RES-ZZZZZZ', 'c'))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
