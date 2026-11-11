import type { OrdenViewDto } from '../ordenes/dto/ordenes.dto';
import { money } from '../common/moneda.util';
import type { AccionOrden } from './acciones';
import type { MovilOrdenDto, MovilOrdenResumenDto } from './dto/bff.dto';

/** "UIO-GYE" for a direct flight, "UIO-GYE-UIO" for a return: the first origin and then every destination. */
export function rutaDe(itinerarios: OrdenViewDto['itinerarios']): string {
  if (itinerarios.length === 0) return '';
  return [itinerarios[0].origen, ...itinerarios.map((t) => t.destino)].join('-');
}

/** The mobile list row: just enough for a card. */
export function aMovilResumen(vista: OrdenViewDto): MovilOrdenResumenDto {
  return {
    numero: vista.numeroOrden,
    estado: vista.estado,
    total: vista.total.monto,
    moneda: vista.total.moneda,
    ruta: rutaDe(vista.itinerarios),
    ...(vista.itinerarios[0] ? { salida: vista.itinerarios[0].salida } : {}),
    pax: vista.pasajeros.length,
  };
}

/**
 * The mobile detail: flat, no history, payment, contact or internal ids. Seats are a plain list in the order of
 * the legs ('' when the passenger picked none for a leg), so the app needs no flight numbers to match them.
 */
export function aMovil(vista: OrdenViewDto, acciones: AccionOrden[]): MovilOrdenDto {
  return {
    numero: vista.numeroOrden,
    pnr: vista.pnr,
    estado: vista.estado,
    total: vista.total.monto,
    moneda: vista.total.moneda,
    tramos: vista.itinerarios.map((t) => ({ vuelo: t.numeroVuelo, de: t.origen, a: t.destino, sale: t.salida, llega: t.llegada })),
    pasajeros: vista.pasajeros.map((p) => {
      const asientos = vista.itinerarios.map((t) => p.asientos?.find((a) => a.numeroVuelo === t.numeroVuelo)?.asiento ?? '');
      return {
        nombre: `${p.nombres} ${p.apellidos}`.trim(),
        eTicket: p.eTicket,
        asientos: asientos.some(Boolean) ? asientos : [],
        ...(p.qr ? { qr: p.qr } : {}),
      };
    }),
    acciones: acciones.map((a) => a.codigo),
  };
}

export interface ImportesEntrada {
  moneda: string;
  totalMinor: number;
  factura?: { subtotalMinor: number; ivaMinor: number } | null;
}

/** Breakdown from the invoice when there is one (subtotal + IVA is what was charged); otherwise only the total. */
export function importesDe(entrada: ImportesEntrada) {
  return {
    ...(entrada.factura ? { subtotal: money(entrada.factura.subtotalMinor, entrada.moneda), impuestos: money(entrada.factura.ivaMinor, entrada.moneda) } : {}),
    total: money(entrada.totalMinor, entrada.moneda),
  };
}
