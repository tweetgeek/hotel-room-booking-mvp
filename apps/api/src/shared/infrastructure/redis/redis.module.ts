import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../config/env.schema';

export const REDIS_CACHE = Symbol('RedisCache');
export const REDIS_ACCESS = Symbol('RedisAccess');

function connect(config: ConfigService<Env, true>, db: number): Redis {
  return new Redis(config.get('REDIS_URL', { infer: true }), {
    db,
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
}

@Global()
@Module({
  providers: [
    // Cache and access tokens use separate logical databases so a projection rebuild
    // can FLUSHDB the cache without logging guests out (research R-08)
    {
      provide: REDIS_CACHE,
      useFactory: (config: ConfigService<Env, true>) =>
        connect(config, config.get('REDIS_CACHE_DB', { infer: true })),
      inject: [ConfigService],
    },
    {
      provide: REDIS_ACCESS,
      useFactory: (config: ConfigService<Env, true>) =>
        connect(config, config.get('REDIS_ACCESS_DB', { infer: true })),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CACHE, REDIS_ACCESS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CACHE) private readonly cache: Redis,
    @Inject(REDIS_ACCESS) private readonly access: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.cache.quit(), this.access.quit()]);
  }
}
