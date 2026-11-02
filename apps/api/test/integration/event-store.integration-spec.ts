import type { Knex } from 'knex';
import { connectTestDatabase, truncateAll } from './support/test-database';
import { MariaDbEventStore } from '../../src/booking/infrastructure/persistence/mariadb-event-store';
import { KnexUnitOfWork } from '../../src/shared/infrastructure/persistence/knex-unit-of-work';
import { ConcurrencyError } from '../../src/shared/application/ports/event-store';
import type { DomainEvent } from '../../src/shared/domain/domain-event';

const event = (eventType: string, payload: Record<string, unknown> = {}): DomainEvent => ({
  eventType,
  payload,
  metadata: { correlationId: 'corr-1', causationId: 'Test', occurredAt: '2026-11-01T10:15:30.123Z' },
});

describe('MariaDbEventStore', () => {
  let db: Knex;
  let store: MariaDbEventStore;
  let uow: KnexUnitOfWork;

  beforeAll(() => {
    db = connectTestDatabase();
    store = new MariaDbEventStore(db);
    uow = new KnexUnitOfWork(db);
  });
  beforeEach(() => truncateAll(db));
  afterAll(() => db.destroy());

  it('appends events as consecutive stream versions and loads them back with metadata', async () => {
    await uow.run((tx) => store.append('RES-AAAAAA', 0, [event('ReservationRequested', { roomId: 1 })], tx));
    await uow.run((tx) => store.append('RES-AAAAAA', 1, [event('PaymentConfirmed')], tx));

    const loaded = await store.load('RES-AAAAAA');
    expect(loaded.map((e) => e.streamVersion)).toEqual([1, 2]);
    expect(loaded[0].event).toEqual(event('ReservationRequested', { roomId: 1 }));
    expect(loaded[0].streamId).toBe('RES-AAAAAA');
    expect(loaded[1].position).toBeGreaterThan(loaded[0].position);
  });

  it('reads all events across streams in batches ordered by position', async () => {
    await uow.run((tx) => store.append('RES-AAAAAA', 0, [event('One')], tx));
    await uow.run((tx) => store.append('RES-BBBBBB', 0, [event('Two'), event('Three')], tx));

    const first = await store.readAll(0, 2);
    expect(first.map((e) => e.event.eventType)).toEqual(['One', 'Two']);
    const rest = await store.readAll(first[1].position, 10);
    expect(rest.map((e) => e.event.eventType)).toEqual(['Three']);
  });

  it('lets exactly one of two concurrent appends with the same expected version succeed', async () => {
    await uow.run((tx) => store.append('RES-AAAAAA', 0, [event('One')], tx));

    const results = await Promise.allSettled([
      uow.run((tx) => store.append('RES-AAAAAA', 1, [event('Left')], tx)),
      uow.run((tx) => store.append('RES-AAAAAA', 1, [event('Right')], tx)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConcurrencyError);
    expect(await store.load('RES-AAAAAA')).toHaveLength(2);
  });

  it('rolls the append back together with the unit of work', async () => {
    await expect(
      uow.run(async (tx) => {
        await store.append('RES-AAAAAA', 0, [event('One')], tx);
        throw new Error('something else in the transaction failed');
      }),
    ).rejects.toThrow('something else');
    expect(await store.load('RES-AAAAAA')).toEqual([]);
  });
});
