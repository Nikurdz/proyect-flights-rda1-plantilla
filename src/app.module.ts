import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { dbSsl } from './modules/vuelos/common/db-ssl';
import { VuelosModule } from './modules/vuelos/vuelos.module';

@Module({
  imports: [
    // Carga de variables de entorno globales
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración centralizada de TypeORM usando DATABASE_URL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Precaución en producción
        // A free Postgres allows few connections (Aiven: 20): keep the pool small. DB_POOL_MAX overrides.
        extra: { max: Number(configService.get<string>('DB_POOL_MAX')) || 5 },
        // Managed Postgres needs TLS. DB_SSL_CA (the provider's CA certificate, PEM) turns on full verification; without it
        // PGSSLMODE=require (read by `pg`) encrypts the connection as before.
        ssl: dbSsl({ DB_SSL_CA: configService.get<string>('DB_SSL_CA') }),
      }),
    }),

    VuelosModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
