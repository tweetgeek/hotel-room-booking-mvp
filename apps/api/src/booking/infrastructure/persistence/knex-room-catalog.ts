import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import type { RoomId } from '../../../shared/domain/ids';
import { Money } from '../../../shared/domain/money';
import { KNEX } from '../../../shared/infrastructure/persistence/knex.token';
import type { RoomCatalog } from '../../application/ports/room-catalog';

@Injectable()
export class KnexRoomCatalog implements RoomCatalog {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async priceOf(roomId: RoomId): Promise<Money | null> {
    const row = await this.db('rooms')
      .select('price_per_night', 'currency')
      .where({ id: roomId.value })
      .first();
    return row ? Money.of(row.price_per_night, row.currency) : null;
  }
}
