import { InMemoryEventStore } from '../../support/in-memory-event-store';
import { InMemoryUnitOfWork } from '../../support/in-memory-unit-of-work';
import { ConcurrencyError } from '../../../../src/shared/application/ports/event-store';
import type { DomainEvent } from '../../../../src/shared/domain/domain-event';

const event = (eventType: string): DomainEvent => ({
  eventType,
  payload: {},
  metadata: { correlationId: 'c', causationId: 'test', occurredAt: '2026-11-01T10:00:00.000Z' },
});

describe('InMemoryEventStore (test double behaves like the real store)', () => {
  it('appends with optimistic concurrency and numbers positions globally', async () => {
    const store = new InMemoryEventStore();
    const uow = new InMemoryUnitOfWork();
    await uow.run((tx) => store.append('RES-A', 0, [event('One')], tx));
    await uow.run((tx) => store.append('RES-B', 0, [event('Two')], tx));
    await uow.run((tx) => store.append('RES-A', 1, [event('Three')], tx));

    const a = await store.load('RES-A');
    expect(a.map((e) => [e.streamVersion, e.position])).toEqual([
      [1, 1],
      [2, 3],
    ]);
    await expect(uow.run((tx) => store.append('RES-A', 1, [event('Stale')], tx))).rejects.toBeInstanceOf(
      ConcurrencyError,
    );
    expect((await store.readAll(0, 10)).map((e) => e.event.eventType)).toEqual(['One', 'Two', 'Three']);
  });

  it('discards appended events when the unit of work fails', async () => {
    const store = new InMemoryEventStore();
    const uow = new InMemoryUnitOfWork();
    await expect(
      uow.run(async (tx) => {
        await store.append('RES-A', 0, [event('One')], tx);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.load('RES-A')).toEqual([]);
  });
});
