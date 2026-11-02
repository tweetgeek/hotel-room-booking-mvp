import type { CommandBus } from '@nestjs/cqrs';
import { ExpirePendingReservationsJob } from '../../../../src/booking/infrastructure/scheduling/expire-pending-reservations.job';
import { ExpireReservationCommand } from '../../../../src/booking/application/commands/expire-reservation.command';
import { InMemoryReadModelViews } from '../../support/in-memory-read-model-views';
import { FixedClock } from '../../support/fixed-clock';
import type { ReservationRow } from '../../../../src/booking/application/ports/read-model-views';

const pending = (
  id: string,
  createdAt: string,
  status: ReservationRow['status'] = 'PendingPayment',
): ReservationRow => ({
  id,
  roomId: 1,
  roomName: 'Pokój',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  checkIn: '2026-11-10',
  checkOut: '2026-11-12',
  nights: 2,
  guestName: 'A',
  guestEmail: 'a@example.com',
  totalAmount: 64000,
  currency: 'PLN',
  status,
  rejectionReason: null,
  refundAmount: null,
  paymentId: `PAY-${id.slice(4)}0000`,
  createdAt,
  updatedAt: createdAt,
});

describe('ExpirePendingReservationsJob', () => {
  it('expires only pending reservations created before now minus the TTL', async () => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(
      pending('RES-OLD001', '2026-11-03T09:40:00.000Z'),
      pending('RES-NEW001', '2026-11-03T09:50:00.000Z'),
      pending('RES-DONE01', '2026-11-03T09:00:00.000Z', 'Confirmed'),
    );
    const commandBus = { execute: jest.fn(async () => ({ applied: true })) } as unknown as CommandBus;
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const job = new ExpirePendingReservationsJob(
      views,
      commandBus,
      FixedClock.at('2026-11-03T10:00:00.000Z'),
      15,
      logger,
    );

    expect(await job.run()).toBe(1);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect((commandBus.execute as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ExpireReservationCommand);
    expect((commandBus.execute as jest.Mock).mock.calls[0][0].reservationId).toBe('RES-OLD001');
  });

  it('keeps going when one reservation fails to expire', async () => {
    const views = new InMemoryReadModelViews();
    views.reservations.push(
      pending('RES-OLD001', '2026-11-03T09:00:00.000Z'),
      pending('RES-OLD002', '2026-11-03T09:01:00.000Z'),
    );
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ applied: true });
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const job = new ExpirePendingReservationsJob(
      views,
      { execute } as unknown as CommandBus,
      FixedClock.at('2026-11-03T10:00:00.000Z'),
      15,
      logger,
    );

    expect(await job.run()).toBe(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
