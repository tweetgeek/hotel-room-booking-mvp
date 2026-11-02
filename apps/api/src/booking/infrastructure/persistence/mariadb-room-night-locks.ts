import { Injectable } from '@nestjs/common';
import type { Tx } from '../../../shared/application/ports/unit-of-work';
import type { ReservationId, RoomId } from '../../../shared/domain/ids';
import { asKnexTx } from '../../../shared/infrastructure/persistence/knex-unit-of-work';
import type { RoomNightLocks } from '../../application/ports/room-night-locks';
import { RoomNotAvailableError } from '../../domain/errors/room-not-available.error';
import type { Night } from '../../domain/stay';

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

/** The primary key (room_id, night) is the invariant: two inserts for one night cannot both succeed (ADR-003). */
@Injectable()
export class MariaDbRoomNightLocks implements RoomNightLocks {
  async acquire(
    roomId: RoomId,
    nights: readonly Night[],
    reservationId: ReservationId,
    tx: Tx,
  ): Promise<void> {
    const rows = nights.map((night) => ({
      room_id: roomId.value,
      night: night.value,
      reservation_id: reservationId.value,
    }));
    try {
      await asKnexTx(tx)('room_night_locks').insert(rows);
    } catch (error) {
      if ((error as { code?: string }).code === MYSQL_DUPLICATE_ENTRY) throw new RoomNotAvailableError();
      throw error;
    }
  }

  async release(reservationId: ReservationId, tx: Tx): Promise<void> {
    await asKnexTx(tx)('room_night_locks').where({ reservation_id: reservationId.value }).delete();
  }
}
