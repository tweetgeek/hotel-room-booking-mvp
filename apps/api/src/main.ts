import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './shared/presentation/filters/validation-exception.factory';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // The web app is served from another origin (Vite) and from phones on the LAN
  app.enableCors();
  app.useGlobalPipes(createValidationPipe());
  await app.listen(Number(process.env.PORT ?? 3100), '0.0.0.0');
}

void bootstrap();
