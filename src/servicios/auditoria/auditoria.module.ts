import { Module } from '@nestjs/common';
import { ObservabilidadModule } from '../../modules/vuelos/ecommerce/observabilidad/observabilidad.module';
import { crearHealthController } from '../comun/health.controller';
import { infraSatelite, SateliteBaseModule } from '../comun/satelite';

/** The audit service: consumes every event into `auditoria_transacciones` and runs the retention job. */
@Module({
  imports: [SateliteBaseModule, ObservabilidadModule],
  controllers: [crearHealthController('auditoria')],
})
export class AuditoriaServicioModule {}

/** Root module of the process (`dist/servicios/auditoria/main.js`). */
@Module({ imports: [...infraSatelite(), AuditoriaServicioModule] })
export class AuditoriaModule {}
