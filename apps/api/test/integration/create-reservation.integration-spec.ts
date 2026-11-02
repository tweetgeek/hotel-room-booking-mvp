import { createTestApp, type TestApp } from './support/create-test-app';
import { truncateAll } from './support/test-database';
import { flushTestRedis } from './support/test-redis';
import { CommandBus } from '@nestjs/cqrs';
import { CreateReservationCommand } from '../../src/booking/application/commands/create-reservation.command';
import { RoomNotAvailableError } from '../../src/booking/domain/errors';

const command = (overrides: Partial<CreateReservationCommand> = {}) =>
  new CreateReservationCommand({
    roomId: 1,
    checkIn: '2027-03-10',
    checkOut: '2027-03-13',
    guestName: 'Anna Kowalska',
    guestEmail: 'anna@example.com',
    correlationId: 'corr-it',
    ...overrides,
  });

describe('CreateReservation on MariaDB', () => {
  let app: TestApp;
  let commandBus: CommandBus;

  beforeAll(async () => {
    app = await createTestApp();
    commandBus = app.app.get(CommandBus);
  });
  beforeEach(async () => {
    await truncateAll(app.db);
    await flushTestRedis();
  });
  afterAll(() => app.close());

  it('stores the event and the night locks in one transaction', async () => {
    const result = await commandBus.execute(command());

    const events = await app.db('events').where({ stream_id: result.reservationId });
    expect(events).toHaveLength(1);
    const locks = await app
      .db('room_night_locks')
      .where({ reservation_id: result.reservationId })
      .orderBy('night');
    expect(locks.map((l) => l.night)).toEqual(['2027-03-10', '2027-03-11', '2027-03-12']);
  });

  it('rolls back both the event and the locks when a night is already taken', async () => {
    await commandBus.execute(command({ checkIn: '2027-03-12', checkOut: '2027-03-14' }));

    await expect(commandBus.execute(command())).rejects.toBeInstanceOf(RoomNotAvailableError);

    expect(await app.db('events').count({ n: '*' }).first()).toEqual({ n: 1 });
    expect(await app.db('room_night_locks').count({ n: '*' }).first()).toEqual({ n: 2 });
  });

  it('lets exactly one of each pair of concurrent reservations for the same nights succeed (SC-003)', async () => {
    const pairs = 100;
    const outcomes = await Promise.all(
      Array.from({ length: pairs }, (_, i) => {
        const checkIn = `2027-0${1 + (i % 9)}-${String(1 + Math.floor(i / 9)).padStart(2, '0')}`;
        const checkOut = `2027-0${1 + (i % 9)}-${String(2 + Math.floor(i / 9)).padStart(2, '0')}`;
        const make = () => commandBus.execute(command({ roomId: 1 + (i % 3), checkIn, checkOut }));
        return Promise.allSettled([make(), make()]);
      }),
    );

    const successes = outcomes.flat().filter((o) => o.status === 'fulfilled').length;
    const conflicts = outcomes
      .flat()
      .filter((o): o is PromiseRejectedResult => o.status === 'rejected')
      .filter((o) => o.reason instanceof RoomNotAvailableError).length;
    const otherFailures = outcomes
      .flat()
      .filter((o): o is PromiseRejectedResult => o.status === 'rejected')
      .filter((o) => !(o.reason instanceof RoomNotAvailableError))
      .map((o) => String((o.reason as { code?: string }).code ?? o.reason));
    expect(otherFailures).toEqual([]);
    expect(successes).toBe(pairs);
    expect(conflicts).toBe(pairs);
    expect(await app.db('room_night_locks').count({ n: '*' }).first()).toEqual({ n: pairs });
  });
});
