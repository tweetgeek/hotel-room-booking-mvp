import type { RoomId } from '../../../shared/domain/ids';
import type { Money } from '../../../shared/domain/money';

export const ROOM_CATALOG = Symbol('RoomCatalog');

/** Reference data for the write side: the price at the moment of reserving (FR-008). */
export interface RoomCatalog {
  priceOf(roomId: RoomId): Promise<Money | null>;
}
