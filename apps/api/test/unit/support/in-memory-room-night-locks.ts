import type { Tx } from '../../../src/shared/application/ports/unit-of-work';
import type { ReservationId, RoomId } from '../../../src/shared/domain/ids';
import type { RoomNightLocks } from '../../../src/booking/application/ports/room-night-locks';
import { RoomNotAvailableError } from '../../../src/booking/domain/errors/room-not-available.error';
import type { Night } from '../../../src/booking/domain/stay';
import { asInMemoryTx } from './in-memory-unit-of-work';

export class InMemoryRoomNightLocks implements RoomNightLocks {
  private readonly locks = new Map<string, string>();

  async acquire(
    roomId: RoomId,
    nights: readonly Night[],
    reservationId: ReservationId,
    tx: Tx,
  ): Promise<void> {
    const keys = nights.map((n) => `${roomId.value}:${n.value}`);
    if (keys.some((k) => this.locks.has(k))) throw new RoomNotAvailableError();
    asInMemoryTx(tx).stage(() => {
      for (const key of keys) this.locks.set(key, reservationId.value);
    });
  }

  async release(reservationId: ReservationId, tx: Tx): Promise<void> {
    asInMemoryTx(tx).stage(() => {
      for (const [key, holder] of this.locks) {
        if (holder === reservationId.value) this.locks.delete(key);
      }
    });
  }

  seed(roomId: number, nights: string[], reservationId: string): void {
    for (const night of nights) this.locks.set(`${roomId}:${night}`, reservationId);
  }

  heldBy(reservationId: string): string[] {
    return [...this.locks.entries()]
      .filter(([, holder]) => holder === reservationId)
      .map(([key]) => key.split(':')[1])
      .sort();
  }
}
