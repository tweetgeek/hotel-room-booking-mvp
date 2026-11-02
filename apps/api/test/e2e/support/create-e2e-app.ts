import { createServer } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createValidationPipe } from '../../../src/shared/presentation/filters/validation-exception.factory';

export interface E2eApp {
  app: INestApplication;
  baseUrl: string;
  close(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Boots the HTTP server on a free port and points the payment operator simulator's webhook
 * at that same server, so the real asynchronous delivery is exercised end to end.
 */
export async function createE2eApp(): Promise<E2eApp> {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.API_BASE_URL = baseUrl;
  // The module graph reads API_BASE_URL at import time, so import after setting it
  const { AppModule } = await import('../../../src/app.module');
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.useGlobalPipes(createValidationPipe());
  await app.listen(port, '127.0.0.1');
  return { app, baseUrl, close: () => app.close() };
}
