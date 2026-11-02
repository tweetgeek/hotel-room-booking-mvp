import { commandWorld, createCommand } from './support';
import {
  ConfirmPaymentCommand,
  ConfirmPaymentHandler,
} from '../../../../src/booking/application/commands/confirm-payment.command';
import {
  RejectPaymentCommand,
  RejectPaymentHandler,
} from '../../../../src/booking/application/commands/reject-payment.command';
import {
  ExpireReservationCommand,
  ExpireReservationHandler,
} from '../../../../src/booking/application/commands/expire-reservation.command';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';

async function worldWithPending() {
  const w = commandWorld();
  const created = await w.createHandler.execute(createCommand());
  w.publisher.published.length = 0;
  const confirm = new ConfirmPaymentHandler(w.repository, w.locks, w.clock, w.uow, w.publisher, w.logger);
  const reject = new RejectPaymentHandler(w.repository, w.locks, w.clock, w.uow, w.publisher, w.logger);
  const expire = new ExpireReservationHandler(w.repository, w.locks, w.clock, w.uow, w.publisher, w.logger);
  return { ...w, created, confirm, reject, expire };
}

describe('payment decision handlers', () => {
  it('ConfirmPayment appends PaymentConfirmed with expected version 1 and keeps the night locks', async () => {
    const w = await worldWithPending();

    const result = await w.confirm.execute(
      new ConfirmPaymentCommand(w.created.reservationId, w.created.paymentId, 'corr-2'),
    );

    expect(result).toEqual({ applied: true });
    const stored = await w.eventStore.load(w.created.reservationId);
    expect(stored.map((e) => [e.event.eventType, e.streamVersion])).toEqual([
      ['ReservationRequested', 1],
      ['PaymentConfirmed', 2],
    ]);
    expect(stored[1].event.metadata.causationId).toBe('ConfirmPayment');
    expect(w.locks.heldBy(w.created.reservationId)).toHaveLength(3);
    expect(w.publisher.published.map((e) => e.event.eventType)).toEqual(['PaymentConfirmed']);
  });

  it('RejectPayment appends PaymentRejected with the reason and releases the night locks in the same transaction', async () => {
    const w = await worldWithPending();

    const result = await w.reject.execute(
      new RejectPaymentCommand(w.created.reservationId, w.created.paymentId, 'abandoned_by_guest', 'corr-2'),
    );

    expect(result).toEqual({ applied: true });
    const stored = await w.eventStore.load(w.created.reservationId);
    expect(stored[1].event.payload).toMatchObject({ reason: 'abandoned_by_guest' });
    expect(w.locks.heldBy(w.created.reservationId)).toEqual([]);
  });

  it('ExpireReservation appends ReservationExpired and releases the night locks', async () => {
    const w = await worldWithPending();

    expect(await w.expire.execute(new ExpireReservationCommand(w.created.reservationId, 'job-1'))).toEqual({
      applied: true,
    });

    const stored = await w.eventStore.load(w.created.reservationId);
    expect(stored[1].event.eventType).toBe('ReservationExpired');
    expect(w.locks.heldBy(w.created.reservationId)).toEqual([]);
  });

  it('a decision outside PendingPayment is a no-op with applied: false and a warning (FR-010)', async () => {
    const w = await worldWithPending();
    await w.confirm.execute(
      new ConfirmPaymentCommand(w.created.reservationId, w.created.paymentId, 'corr-2'),
    );
    w.publisher.published.length = 0;

    expect(
      await w.confirm.execute(
        new ConfirmPaymentCommand(w.created.reservationId, w.created.paymentId, 'corr-3'),
      ),
    ).toEqual({
      applied: false,
    });
    expect(
      await w.reject.execute(
        new RejectPaymentCommand(
          w.created.reservationId,
          w.created.paymentId,
          'rejected_by_operator',
          'corr-4',
        ),
      ),
    ).toEqual({ applied: false });
    expect(await w.expire.execute(new ExpireReservationCommand(w.created.reservationId, 'job-2'))).toEqual({
      applied: false,
    });

    expect(await w.eventStore.load(w.created.reservationId)).toHaveLength(2);
    expect(w.publisher.published).toEqual([]);
    expect(w.logger.warn).toHaveBeenCalledTimes(3);
  });

  it('throws NotFoundError for an unknown reservation', async () => {
    const w = await worldWithPending();
    await expect(
      w.confirm.execute(new ConfirmPaymentCommand('RES-ZZZZZZ', 'PAY-ZZZZZZZZZZ', 'c')),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
