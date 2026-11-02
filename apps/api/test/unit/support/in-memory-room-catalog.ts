import type { RoomId } from '../../../src/shared/domain/ids';
import { Money } from '../../../src/shared/domain/money';
import type { RoomCatalog } from '../../../src/booking/application/ports/room-catalog';

export class InMemoryRoomCatalog implements RoomCatalog {
  constructor(private readonly prices: Record<number, number>) {}

  async priceOf(roomId: RoomId): Promise<Money | null> {
    const price = this.prices[roomId.value];
    return price === undefined ? null : Money.of(price);
  }

  setPrice(roomId: number, price: number): void {
    this.prices[roomId] = price;
  }
}
