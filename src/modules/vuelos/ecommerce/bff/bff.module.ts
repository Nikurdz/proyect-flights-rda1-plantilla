import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { Orden } from '../ordenes/entities/orden.entity';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { BffOrdenesService } from './bff-ordenes.service';
import { ExpedienteOrdenesController, MovilOrdenesController, WebOrdenesController } from './bff.controller';

/**
 * Per-client views of the order (mobile, web, back office). A read-only layer over OrdenesService: no entities, no
 * migrations, no events and no new business rules.
 */
@Module({
  imports: [VuelosCoreModule, OrdenesModule, TypeOrmModule.forFeature([Orden])],
  controllers: [MovilOrdenesController, WebOrdenesController, ExpedienteOrdenesController],
  providers: [BffOrdenesService, RolesGuard],
})
export class BffModule {}
