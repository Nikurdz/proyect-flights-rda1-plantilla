import { Module } from '@nestjs/common';
import { CatalogoModule } from './catalogo/catalogo.module';
import { IdentidadModule } from './identidad/identidad.module';
import { MercadosModule } from './mercados/mercados.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { OfertasModule } from './ofertas/ofertas.module';
import { OrdenesModule } from './ordenes/ordenes.module';
import { PagosModule } from './pagos/pagos.module';

/**
 * The e-commerce layer of the platform (SRS release R1 "Compra de vuelo"): identity, market
 * configuration, search and pricing, offers/checkout, payments, orders and notifications. It
 * lives inside the Vuelos module so the template's rule holds — a team enables only its own
 * module in app.module.ts — and it sells from the flight core's inventory in-process.
 */
@Module({
  imports: [MercadosModule, IdentidadModule, CatalogoModule, OfertasModule, PagosModule, OrdenesModule, NotificacionesModule],
})
export class EcommerceModule {}
