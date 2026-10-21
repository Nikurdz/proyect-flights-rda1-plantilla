import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { Pago } from './entities/pago.entity';
import { PagosService } from './pagos.service';
import { ANTIFRAUDE, PASARELA_PAGO } from './ports/pagos.ports';
import { AntifraudeSimulado, PasarelaSimulada } from './ports/simulated-adapters';

@Module({
  imports: [VuelosCoreModule, TypeOrmModule.forFeature([Pago])],
  providers: [
    PagosService,
    {
      // RDA1 has no real payment provider: bind the simulated gateway and fraud engine. A real
      // adapter implementing the same port replaces these two providers.
      provide: PASARELA_PAGO,
      useFactory: () => {
        new Logger('PagosModule').warn('Payments run on a SIMULATED gateway: no real money moves.');
        return new PasarelaSimulada();
      },
    },
    { provide: ANTIFRAUDE, useClass: AntifraudeSimulado },
  ],
  exports: [PagosService, TypeOrmModule],
})
export class PagosModule {}
