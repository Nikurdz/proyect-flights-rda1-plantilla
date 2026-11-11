import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { AuditoriaCambioSubscriber } from './auditoria-cambio.subscriber';
import { AuditoriaTransaccionesService } from './auditoria-transacciones.service';
import { AuditoriaSaga, AuditoriaSagaPaso, AuditoriaTransaccion, PeticionHttp } from './entities/auditoria.entity';
import { PeticionesHttpService } from './peticiones-http.service';
import { RetencionAuditoriaService } from './retencion-auditoria.service';
import { SagasRegistroService } from './sagas-registro.service';

/** The durable record of what the system did: domain events, saga runs and a bounded sample of the HTTP traffic. */
@Module({
  imports: [VuelosCoreModule, TypeOrmModule.forFeature([AuditoriaTransaccion, AuditoriaSaga, AuditoriaSagaPaso, PeticionHttp])],
  providers: [AuditoriaCambioSubscriber, RetencionAuditoriaService, AuditoriaTransaccionesService, SagasRegistroService, PeticionesHttpService],
  exports: [SagasRegistroService, TypeOrmModule],
})
export class ObservabilidadModule {}
