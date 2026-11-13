import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dbSsl, dbUrl } from '../modules/vuelos/common/db-ssl';

/**
 * The TypeORM options every process of the platform shares: `DATABASE_URL`, TLS (`DB_SSL_CA`), a small pool (`DB_POOL_MAX`).
 * `app.module.ts` (the monolith and the `api` core) synchronizes the schema outside production; the satellite services
 * (src/servicios) pass `synchronize: false` because the core owns the schema and migrates it, and `todasLasEntidades` because
 * the entities of a satellite's modules point (relations) at entities of the rest of the platform, which TypeORM must know.
 */
export function typeOrmConfig(configService: ConfigService, opciones: { synchronize?: boolean; todasLasEntidades?: boolean } = {}): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: dbUrl(configService.get<string>('DATABASE_URL'), { DB_SSL_CA: configService.get<string>('DB_SSL_CA') }),
    // Same discovery as the migrations' DataSource (works for ts-node and the compiled build).
    ...(opciones.todasLasEntidades ? { entities: [join(__dirname, '..', 'modules', 'vuelos', '**', '*.entity.{ts,js}')] } : { autoLoadEntities: true }),
    synchronize: opciones.synchronize ?? configService.get<string>('NODE_ENV') !== 'production', // Precaución en producción
    // A free Postgres allows few connections (Aiven: 20): keep the pool small. DB_POOL_MAX overrides.
    extra: { max: Number(configService.get<string>('DB_POOL_MAX')) || 5 },
    // Managed Postgres needs TLS. DB_SSL_CA (the provider's CA certificate, PEM) turns on full verification; without it
    // PGSSLMODE=require (read by `pg`) encrypts the connection as before.
    ssl: dbSsl({ DB_SSL_CA: configService.get<string>('DB_SSL_CA') }),
  };
}
