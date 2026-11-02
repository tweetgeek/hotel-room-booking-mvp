import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { READ_MODEL_CACHE, type ReadModelCache } from '../ports/read-model-cache';
import { READ_MODEL_VIEWS, type ReadModelViews, type RoomCard } from '../ports/read-model-views';

export class ListRoomsQuery {}

export const ROOMS_LIST_KEY = 'rooms:list';
export const ROOMS_LIST_TTL_SECONDS = 600;

@QueryHandler(ListRoomsQuery)
export class ListRoomsHandler implements IQueryHandler<ListRoomsQuery, RoomCard[]> {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
  ) {}

  execute(_query: ListRoomsQuery): Promise<RoomCard[]> {
    return this.cache.getOrLoad(ROOMS_LIST_KEY, ROOMS_LIST_TTL_SECONDS, () => this.views.roomCards());
  }
}
