import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { READ_MODEL_CACHE, type ReadModelCache } from '../ports/read-model-cache';
import { READ_MODEL_VIEWS, type BlockedNight, type ReadModelViews } from '../ports/read-model-views';

export class GetBlockedNightsQuery {
  constructor(
    readonly roomId: number,
    readonly from: string,
    readonly to: string,
  ) {}
}

export interface BlockedNightsResult {
  roomId: number;
  nights: BlockedNight[];
}

export const blockedNightsKey = (roomId: number, from: string, to: string): string =>
  `room:${roomId}:nights:${from}:${to}`;
export const roomNightsPattern = (roomId: number): string => `room:${roomId}:nights:*`;
export const BLOCKED_NIGHTS_TTL_SECONDS = 60;

@QueryHandler(GetBlockedNightsQuery)
export class GetBlockedNightsHandler implements IQueryHandler<GetBlockedNightsQuery, BlockedNightsResult> {
  constructor(
    @Inject(READ_MODEL_VIEWS) private readonly views: ReadModelViews,
    @Inject(READ_MODEL_CACHE) private readonly cache: ReadModelCache,
  ) {}

  execute(query: GetBlockedNightsQuery): Promise<BlockedNightsResult> {
    return this.cache.getOrLoad(
      blockedNightsKey(query.roomId, query.from, query.to),
      BLOCKED_NIGHTS_TTL_SECONDS,
      async () => ({
        roomId: query.roomId,
        nights: await this.views.blockedNights(query.roomId, query.from, query.to),
      }),
    );
  }
}
