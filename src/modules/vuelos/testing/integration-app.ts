import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { VuelosModule } from '../vuelos.module';

loadDotenv({ quiet: true });

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** `describe` when an integration database is configured, otherwise a skipped suite. */
export const describeIntegration = TEST_DATABASE_URL ? describe : describe.skip;

export interface IntegrationApp {
  app: INestApplication;
  dataSource: DataSource;
  schema: string;
  close: () => Promise<void>;
}

/**
 * Boots the real VuelosModule against a real Postgres, mirroring main.ts (global prefix and
 * ValidationPipe). Every suite gets its own schema, so suites can run in parallel workers
 * without clobbering each other, and the schema is dropped on close.
 */
export async function createIntegrationApp(env: Record<string, string> = {}): Promise<IntegrationApp> {
  const schema = `it_${randomBytes(4).toString('hex')}`;

  // TypeORM synchronizes tables into a schema but does not create the schema itself.
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.end();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            NODE_ENV: 'test',
            JWT_SECRET: 'integration-test-secret-integration-test-secret',
            TAX_RATE: '0.15',
            DEFAULT_CURRENCY: 'USD',
            OFFER_TTL_MINUTES: '15',
            HOLD_TTL_MINUTES: '15',
            ...env,
          }),
        ],
      }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: TEST_DATABASE_URL,
        schema,
        autoLoadEntities: true,
        synchronize: true,
      }),
      VuelosModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  // One long-lived listener: supertest reuses it instead of opening and closing a port per request.
  await app.listen(0);

  const dataSource = app.get(DataSource);
  return {
    app,
    dataSource,
    schema,
    close: async () => {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await app.close();
    },
  };
}
