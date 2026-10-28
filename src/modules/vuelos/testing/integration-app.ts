import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
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
/**
 * ConfigService reads process.env before the values given to the test app, and loadDotenv() pulls in the developer's
 * own `.env` (real Booking keys, CHECKIN_CLOSES_HOURS=0, WEBHOOKS_ALLOW_PRIVATE_HOSTS=true for the Tailscale tests…).
 * The variables below change what the app does, so a suite starts without them and gets only what it passes in `env`.
 */
const ISOLATED_ENV = [
  'CHECKIN_OPENS_HOURS',
  'CHECKIN_CLOSES_HOURS',
  'WEBHOOKS_ALLOW_PRIVATE_HOSTS',
  'BOOKING_WEBHOOK_URL',
  'BOOKING_WEBHOOK_SECRET',
  'BOOKING_STOCK_API_KEY',
  'BOOKING_PAGOS_API_KEY',
  'GRPC_STOCK_URL',
  'NODE_ID',
  'NODE_SOURCE',
  'PARTNER_CLIENT_ID',
  'PARTNER_CLIENT_SECRET',
];

export async function createIntegrationApp(env: Record<string, string> = {}): Promise<IntegrationApp> {
  const savedEnv: Record<string, string | undefined> = {};
  for (const name of ISOLATED_ENV) {
    savedEnv[name] = process.env[name];
    if (name in env) process.env[name] = env[name];
    else delete process.env[name];
  }
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

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
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
      for (const [name, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };
}
