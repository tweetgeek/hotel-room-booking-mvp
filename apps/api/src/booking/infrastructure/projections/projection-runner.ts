import { Inject, Injectable } from '@nestjs/common';
import { EVENT_STORE, type EventStore } from '../../../shared/application/ports/event-store';
import type { Knex } from 'knex';
import type { StoredEvent } from '../../../shared/domain/domain-event';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { KNEX } from '../../../shared/infrastructure/persistence/knex.token';
import { asKnexTx } from '../../../shared/infrastructure/persistence/knex-unit-of-work';
import { READ_MODEL_CACHE, type ReadModelCache } from '../../application/ports/read-model-cache';
import {
  ReservationProjector,
  type ReadModelChange,
} from '../../application/projections/reservation-projector';
import { roomNightsPattern } from '../../application/queries/get-blocked-nights.query';

export const PROJECTION_NAME = 'reservations';
export const READ_MODEL_TABLES = ['rm_reservations', 'rm_reservation_timeline', 'rm_room_nights'] as const;
export const REBUILD_BATCH_SIZE = 500;

/**
 * Applies one projection plan per event in its own transaction and raises the checkpoint inside
 * it; cache keys are invalidated only after the commit (ADR-004).
 */
@Injectable()
export class ProjectionRunner {
  lastRebuildEventCount = 0;

  constructor(
    @Inject(KNEX) private readonly db: Knex,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
    @Inject(EVENT_STORE) private readonly eventStore: EventStore,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly projector: ReservationProjector,
  ) {}

  async project(events: readonly StoredEvent[]): Promise<void> {
    for (const stored of events) {
      await this.applyOne(stored);
    }
  }

  /**
   * Truncates every read model, resets the checkpoint and replays the whole event store.
   * `room_night_locks` is part of the write path and stays untouched (ADR-003). Returns the last position.
   */
  async rebuild(): Promise<number> {
    await this.db.transaction(async (trx) => {
      for (const table of READ_MODEL_TABLES) await trx.raw(`TRUNCATE TABLE ${table}`);
      await trx('projection_checkpoints')
        .insert({ name: PROJECTION_NAME, last_position: 0 })
        .onConflict('name')
        .merge();
    });
    await this.cache.invalidatePattern('*');

    let position = 0;
    let count = 0;
    for (;;) {
      const batch = await this.eventStore.readAll(position, REBUILD_BATCH_SIZE);
      if (batch.length === 0) break;
      await this.project(batch);
      position = batch[batch.length - 1].position;
      count += batch.length;
    }
    this.lastRebuildEventCount = count;
    return position;
  }

  private async applyOne(stored: StoredEvent): Promise<void> {
    const plan = this.projector.project(stored);
    let roomId: number | undefined;

    // Commands run concurrently, so events of different streams reach the runner out of global
    // order; every change is idempotent and the checkpoint only ever grows (ADR-004)
    await this.uow.run(async (tx) => {
      const trx = asKnexTx(tx);
      for (const change of plan.changes) await applyChange(trx, change);

      if (plan.roomNightsOfReservation) {
        const row = await trx('rm_reservations')
          .select('room_id')
          .where({ id: plan.roomNightsOfReservation })
          .first();
        roomId = row?.room_id;
      }
      await trx('projection_checkpoints')
        .where({ name: PROJECTION_NAME })
        .update({ last_position: trx.raw('GREATEST(last_position, ?)', [stored.position]) });
    });

    await this.cache.invalidate(plan.cacheKeys);
    if (roomId !== undefined) await this.cache.invalidatePattern(roomNightsPattern(roomId));
  }
}

async function applyChange(trx: Knex.Transaction, change: ReadModelChange): Promise<void> {
  switch (change.kind) {
    case 'upsert':
      await trx(change.table).insert(change.row).onConflict().merge();
      return;
    case 'insert-ignore':
      if (change.rows.length > 0) await trx(change.table).insert(change.rows).onConflict().ignore();
      return;
    case 'update':
      await trx(change.table).where(change.where).update(change.set);
      return;
    case 'delete':
      await trx(change.table).where(change.where).delete();
      return;
  }
}
