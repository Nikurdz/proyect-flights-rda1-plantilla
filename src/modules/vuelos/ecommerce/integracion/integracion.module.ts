import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { EsbModule } from '../../esb/esb.module';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { MercadosModule } from '../mercados/mercados.module';
import { ObservabilidadModule } from '../observabilidad/observabilidad.module';
import { PagosModule } from '../pagos/pagos.module';
import { AtraccionesAdapter } from './acl/atracciones.adapter';
import { CircuitBreakers } from './acl/circuit-breakers.service';
import { ClienteProveedor } from './acl/cliente-proveedor';
import { CatalogoExterno, CatalogoExternoCategoria } from './entities/catalogo-externo.entity';
import { ProveedorSalud } from './entities/proveedor-salud.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReservaExterna } from './entities/reserva-externa.entity';
import { ExperienciasService } from './experiencias.service';
import { ExperienciasController, ProveedoresController, ReservasExternasController } from './integracion.controller';
import { ProveedoresService } from './proveedores.service';
import { ReservasExternasService } from './reservas-externas.service';
import { SaludProveedoresService } from './salud-proveedores.service';

/**
 * Partner integration: provider registry, health, catalogue import, and the reservation of their products. Everything that
 * crosses to a partner goes through an anti-corruption adapter and a circuit breaker.
 */
@Module({
  imports: [
    VuelosCoreModule,
    MercadosModule,
    PagosModule,
    FacturacionModule,
    ObservabilidadModule,
    EsbModule,
    TypeOrmModule.forFeature([Proveedor, ProveedorSalud, CatalogoExterno, CatalogoExternoCategoria, ReservaExterna]),
  ],
  controllers: [ProveedoresController, ExperienciasController, ReservasExternasController],
  providers: [ClienteProveedor, CircuitBreakers, AtraccionesAdapter, ProveedoresService, ExperienciasService, ReservasExternasService, SaludProveedoresService, RolesGuard],
  exports: [ProveedoresService, ExperienciasService, ReservasExternasService, CircuitBreakers, TypeOrmModule],
})
export class IntegracionModule {}
