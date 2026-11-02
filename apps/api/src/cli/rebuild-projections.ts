import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectionRunner } from '../booking/infrastructure/projections/projection-runner';

/** `npm run projections:rebuild`: proves the read models are derivable from the event store alone (US5). */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const runner = app.get(ProjectionRunner);
    const lastPosition = await runner.rebuild();
    console.log(`rebuilt ${runner.lastRebuildEventCount} events, checkpoint=${lastPosition}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
