import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { CancelReservationCommand } from '../application/commands/cancel-reservation.command';
import {
  CreateReservationCommand,
  type CreateReservationResult,
} from '../application/commands/create-reservation.command';
import {
  VerifySecureCodeCommand,
  type AccessGranted,
} from '../application/commands/verify-secure-code.command';
import {
  GetReservationDetailsQuery,
  type ReservationDetails,
} from '../application/queries/get-reservation-details.query';
import { GetReservationStatusQuery } from '../application/queries/get-reservation-status.query';
import type { ReservationStatusRow } from '../application/ports/read-model-views';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationIdPipe } from './dto/reservation-id.pipe';
import { VerifySecureCodeDto } from './dto/verify-secure-code.dto';
import { ReservationAccessGuard } from './guards/reservation-access.guard';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: CreateReservationDto): Promise<CreateReservationResult> {
    return this.commandBus.execute(new CreateReservationCommand({ ...body, correlationId: randomUUID() }));
  }

  @Get(':reservationId/status')
  status(@Param('reservationId', ReservationIdPipe) reservationId: string): Promise<ReservationStatusRow> {
    return this.queryBus.execute(new GetReservationStatusQuery(reservationId));
  }

  @Post(':reservationId/access')
  @HttpCode(200)
  access(
    @Param('reservationId', ReservationIdPipe) reservationId: string,
    @Body() body: VerifySecureCodeDto,
  ): Promise<AccessGranted> {
    return this.commandBus.execute(new VerifySecureCodeCommand(reservationId, body.secureCode));
  }

  @Get(':reservationId')
  @UseGuards(ReservationAccessGuard)
  details(@Param('reservationId', ReservationIdPipe) reservationId: string): Promise<ReservationDetails> {
    return this.queryBus.execute(new GetReservationDetailsQuery(reservationId));
  }

  @Post(':reservationId/cancel')
  @HttpCode(200)
  @UseGuards(ReservationAccessGuard)
  async cancel(
    @Param('reservationId', ReservationIdPipe) reservationId: string,
  ): Promise<ReservationDetails> {
    await this.commandBus.execute(new CancelReservationCommand(reservationId, randomUUID()));
    return this.queryBus.execute(new GetReservationDetailsQuery(reservationId));
  }
}
