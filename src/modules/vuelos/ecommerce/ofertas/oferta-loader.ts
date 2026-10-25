import type { EntityManager } from 'typeorm';
import { DatosFacturacion } from '../facturacion/entities/datos-facturacion.entity';
import { AceptacionCondiciones } from './entities/aceptacion-condiciones.entity';
import { Oferta } from './entities/oferta.entity';
import { OfertaPasajero } from './entities/oferta-pasajero.entity';
import { OfertaTrayecto } from './entities/oferta-trayecto.entity';

/**
 * Attaches to an offer the rows its read model needs: the legs (with their flight and prices), the travellers (with
 * needs and seats), the billing identity and the accepted terms. Done with separate queries, not a join, so the offer
 * itself can be loaded under a row lock (a lock cannot be applied to the outer side of a join).
 */
export async function completarOferta(manager: EntityManager, oferta: Oferta): Promise<Oferta> {
  oferta.trayectos = await manager.find(OfertaTrayecto, { where: { ofertaId: oferta.ofertaId }, relations: { vuelo: true, precios: true }, order: { orden: 'ASC' } });
  oferta.pasajeros = await manager.find(OfertaPasajero, { where: { ofertaId: oferta.ofertaId }, relations: { necesidades: true, asientos: true }, order: { orden: 'ASC' } });
  oferta.datosFacturacion = oferta.datosFacturacionId ? await manager.findOneBy(DatosFacturacion, { datosFacturacionId: oferta.datosFacturacionId }) : null;
  oferta.aceptacion = await manager.findOneBy(AceptacionCondiciones, { ofertaId: oferta.ofertaId });
  return oferta;
}

/** One offer with everything attached; null when it does not exist. `lock` takes a pessimistic write lock on the offer row. */
export async function cargarOferta(manager: EntityManager, ofertaId: string, options: { lock?: boolean } = {}): Promise<Oferta | null> {
  const oferta = await manager.findOne(Oferta, { where: { ofertaId }, ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
  return oferta ? completarOferta(manager, oferta) : null;
}
