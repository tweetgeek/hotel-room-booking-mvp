import type { ReservationId, RoomId } from '../../../shared/domain/ids';
import type { Tx } from '../../../shared/application/ports/unit-of-work';
import type { Night } from '../../domain/stay';

export const ROOM_NIGHT_LOCKS = Symbol('RoomNightLocks');

/** Cross-aggregate invariant guard, written in the same transaction as the events (ADR-003). */
export interface RoomNightLocks {
  /** Throws RoomNotAvailableError when any night is already locked. */
  acquire(roomId: RoomId, nights: readonly Night[], reservationId: ReservationId, tx: Tx): Promise<void>;
  release(reservationId: ReservationId, tx: Tx): Promise<void>;
}
