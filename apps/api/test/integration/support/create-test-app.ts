import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Knex } from 'knex';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { createValidationPipe } from '../../../src/shared/presentation/filters/validation-exception.factory';
import { KNEX } from '../../../src/shared/infrastructure/persistence/knex.token';
import { REDIS_ACCESS, REDIS_CACHE } from '../../../src/shared/infrastructure/redis/redis.module';

export interface TestApp {
  app: INestApplication;
  db: Knex;
  cache: Redis;
  access: Redis;
  close(): Promise<void>;
}

/** Full application wired against hotel_test and Redis db 2/3 (see env.ts). */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  app.useGlobalPipes(createValidationPipe());
  await app.init();
  return {
    app,
    db: app.get<Knex>(KNEX),
    cache: app.get<Redis>(REDIS_CACHE),
    access: app.get<Redis>(REDIS_ACCESS),
    close: () => app.close(),
  };
}
