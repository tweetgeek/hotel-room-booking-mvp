import type { StoredEvent } from '../../../../src/shared/domain/domain-event';
import type { EventPublisher } from '../../../../src/booking/application/ports/event-publisher';
import {
  CreateReservationHandler,
  CreateReservationCommand,
} from '../../../../src/booking/application/commands/create-reservation.command';
import { InMemoryEventStore } from '../../support/in-memory-event-store';
import { InMemoryUnitOfWork } from '../../support/in-memory-unit-of-work';
import { InMemoryRoomNightLocks } from '../../support/in-memory-room-night-locks';
import { InMemoryReservationAccess } from '../../support/in-memory-reservation-access';
import { InMemoryRoomCatalog } from '../../support/in-memory-room-catalog';
import { InMemoryReservationRepository } from '../../support/in-memory-reservation-repository';
import { FixedClock } from '../../support/fixed-clock';
import { SequentialIdGenerator } from '../../support/sequential-id-generator';

export class RecordingEventPublisher implements EventPublisher {
  readonly published: StoredEvent[] = [];
  async publish(events: readonly StoredEvent[]): Promise<void> {
    this.published.push(...events);
  }
}

export function commandWorld(today = '2026-11-03') {
  const eventStore = new InMemoryEventStore();
  const uow = new InMemoryUnitOfWork();
  const repository = new InMemoryReservationRepository(eventStore);
  const locks = new InMemoryRoomNightLocks();
  const access = new InMemoryReservationAccess();
  const catalog = new InMemoryRoomCatalog({ 1: 32000, 2: 45000 });
  const clock = FixedClock.at(`${today}T10:00:00.000Z`, today);
  const ids = new SequentialIdGenerator();
  const publisher = new RecordingEventPublisher();
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
  const createHandler = new CreateReservationHandler(
    catalog,
    repository,
    locks,
    access,
    clock,
    ids,
    uow,
    publisher,
    logger,
  );
  return {
    eventStore,
    uow,
    repository,
    locks,
    access,
    catalog,
    clock,
    ids,
    publisher,
    logger,
    createHandler,
  };
}

export const createCommand = (overrides: Partial<CreateReservationCommand> = {}): CreateReservationCommand =>
  new CreateReservationCommand({
    roomId: 1,
    checkIn: '2026-11-10',
    checkOut: '2026-11-13',
    guestName: 'Anna Kowalska',
    guestEmail: 'anna@example.com',
    correlationId: 'corr-1',
    ...overrides,
  });
