import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { NotFoundError } from '../../../shared/domain/errors/not-found.error';
import { READ_MODEL_CACHE, type ReadModelCache } from '../ports/read-model-cache';
import { READ_MODEL_VIEWS, type ReadModelViews, type RoomCard } from '../ports/read-model-views';

export class GetRoomCardQuery {
  constructor(readonly roomId: number) {}
}

export const roomCardKey = (roomId: number): string => `room:${roomId}:card`;
export const ROOM_CARD_TTL_SECONDS = 600;

@QueryHandler(GetRoomCardQuery)
export class GetRoomCardHandler implements IQueryHandler<GetRoomCardQuery, RoomCard> {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
  ) {}

  async execute(query: GetRoomCardQuery): Promise<RoomCard> {
    const card = await this.cache.getOrLoad(roomCardKey(query.roomId), ROOM_CARD_TTL_SECONDS, async () => {
      const found = await this.views.roomCard(query.roomId);
      if (!found) throw new NotFoundError('Room');
      return found;
    });
    return card;
  }
}
