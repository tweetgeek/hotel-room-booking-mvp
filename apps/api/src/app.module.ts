import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingModule } from './booking/booking.module';
import { PaymentOperatorModule } from './payment-operator-simulator/payment-operator.module';
import { AppConfigModule } from './shared/infrastructure/config/config.module';
import { KnexModule } from './shared/infrastructure/persistence/knex.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { DomainErrorFilter } from './shared/presentation/filters/domain-error.filter';

@Module({
  imports: [
    AppConfigModule,
    KnexModule,
    RedisModule,
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    BookingModule,
    PaymentOperatorModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
