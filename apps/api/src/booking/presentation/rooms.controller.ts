import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { RoomCard } from '../application/ports/read-model-views';
import {
  GetBlockedNightsQuery,
  type BlockedNightsResult,
} from '../application/queries/get-blocked-nights.query';
import { GetRoomCardQuery } from '../application/queries/get-room-card.query';
import { ListRoomsQuery } from '../application/queries/list-rooms.query';
import { BlockedNightsQueryDto } from './dto/blocked-nights-query.dto';
import { intIdParam } from './dto/id-param.pipe';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  list(): Promise<RoomCard[]> {
    return this.queryBus.execute(new ListRoomsQuery());
  }

  @Get(':roomId')
  card(@Param('roomId', intIdParam('roomId')) roomId: number): Promise<RoomCard> {
    return this.queryBus.execute(new GetRoomCardQuery(roomId));
  }

  @Get(':roomId/blocked-nights')
  blockedNights(
    @Param('roomId', intIdParam('roomId')) roomId: number,
    @Query() range: BlockedNightsQueryDto,
  ): Promise<BlockedNightsResult> {
    return this.queryBus.execute(new GetBlockedNightsQuery(roomId, range.from, range.to));
  }
}
