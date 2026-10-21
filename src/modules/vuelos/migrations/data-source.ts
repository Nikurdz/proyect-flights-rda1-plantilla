import 'reflect-metadata';
import { join } from 'node:path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ quiet: true });

/**
 * DataSource for the TypeORM CLI (migration:generate / run / revert) and for the production
 * start-up. The app itself only synchronizes outside production (see app.module.ts), so this is
 * how the schema reaches a production database. The globs work for ts-node (.ts) and the
 * compiled build (.js); entities are discovered, not listed, so a new entity cannot be forgotten.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.MIGRATIONS_DATABASE_URL ?? process.env.DATABASE_URL,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '[0-9]*.{ts,js}')],
  migrationsTableName: 'vuelos_migrations',
  synchronize: false,
});
