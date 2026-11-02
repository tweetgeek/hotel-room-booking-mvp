import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/integration/support/env.ts'],
  testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
  testTimeout: 30_000,
};

export default config;
