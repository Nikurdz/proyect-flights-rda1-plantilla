import { Module, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from '../../common/typeorm-config';
import { WinstonLogger } from '../../modules/vuelos/common/winston-logger';
import { RabbitMqTransport } from '../../modules/vuelos/esb/rabbitmq.transport';
import { SatelliteDomain } from '../../modules/vuelos/common/service-role';
import { VuelosCoreModule } from '../../modules/vuelos/vuelos-core.module';

/**
 * What every satellite container (src/servicios/<name>) needs from the core, and no more: the validated config, the event
 * bus and, when `RABBITMQ_URL` is set, the RabbitMQ transport that feeds the bus from the service's own queue
 * (`RABBITMQ_SERVICE_QUEUE`). The core process owns the schema, so a satellite never synchronizes it.
 */
@Module({
  imports: [VuelosCoreModule],
  providers: [RabbitMqTransport],
  exports: [VuelosCoreModule, RabbitMqTransport],
})
export class SateliteBaseModule {}

/** Environment and database of a satellite process (the same configuration as app.module.ts, with `synchronize: false`). */
export function infraSatelite() {
  return [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmConfig(config, { synchronize: false, todasLasEntidades: true }),
    }),
  ];
}

/** Starts a satellite: forces its role (a different `SERVICE_ROLE` is an error) and listens on `PORT` (default per service). */
export async function arrancarSatelite(opciones: { rol: SatelliteDomain; modulo: Type<unknown>; puertoPorDefecto: number }): Promise<void> {
  const actual = (process.env.SERVICE_ROLE ?? '').trim();
  if (actual && actual !== opciones.rol) {
    throw new Error(`This is the "${opciones.rol}" service but SERVICE_ROLE="${actual}"; unset it or set it to "${opciones.rol}".`);
  }
  process.env.SERVICE_ROLE = opciones.rol;
  const app = await NestFactory.create(opciones.modulo, { logger: new WinstonLogger() });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT || opciones.puertoPorDefecto, '0.0.0.0');
}

/** A failed start must stop the process with a readable error. */
export function alFallar(error: unknown): never {
  console.error(error);
  process.exit(1);
}
