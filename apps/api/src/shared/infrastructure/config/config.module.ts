import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnv } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The single .env lives at the monorepo root; process.env always wins over the file
      envFilePath: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../../../../.env')],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
