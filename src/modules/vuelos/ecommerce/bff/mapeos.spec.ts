import type { OrdenViewDto } from '../ordenes/dto/ordenes.dto';
import { aMovil, aMovilResumen, importesDe, rutaDe } from './mapeos';

const vista = {
  ordenId: 'o-1',
  numeroOrden: 'ORD-7K3M9PQ2XA',
  pnr: 'ABC234',
  estado: 'EMITIDA',
  mercado: 'ec',
  total: { moneda: 'USD', monto: '386.40' },
  itinerarios: [
    { numeroVuelo: 'LA800', operador: { codigo: 'LA', nombre: 'RAM' }, origen: 'UIO', destino: 'GYE', salida: '2026-11-20T13:05:00Z', llegada: '2026-11-20T14:00:00Z', familia: 'BASIC' },
    { numeroVuelo: 'LA801', operador: { codigo: 'LA', nombre: 'RAM' }, origen: 'GYE', destino: 'UIO', salida: '2026-11-25T13:05:00Z', llegada: '2026-11-25T14:00:00Z', familia: 'BASIC' },
  ],
  pasajeros: [
    { id: 'p-1', tipo: 'ADT', nombres: 'David', apellidos: 'Tapia', eTicket: '0451234567890', qr: 'v1.x.y.z', asientos: [{ numeroVuelo: 'LA801', asiento: '12A' }] },
    { id: 'p-2', tipo: 'ADT', nombres: 'Ana', apellidos: 'Mora', eTicket: null },
  ],
  contacto: { correo: 'david@mail.com', telefono: '+593999999999' },
  bookingId: 'b-1',
  pago: { marca: 'VISA', ultimos4: '4242', cuotas: 1 },
  creadaEn: '2026-11-04T15:20:01Z',
  historial: [{ estado: 'EMITIDA', en: '2026-11-04T15:22:10Z' }],
} as unknown as OrdenViewDto;

describe('mapeos BFF', () => {
  it('builds the route from the first origin and every destination', () => {
    expect(rutaDe(vista.itinerarios)).toBe('UIO-GYE-UIO');
    expect(rutaDe([])).toBe('');
  });

  it('shrinks the order to a mobile list row', () => {
    expect(aMovilResumen(vista)).toEqual({ numero: 'ORD-7K3M9PQ2XA', estado: 'EMITIDA', total: '386.40', moneda: 'USD', ruta: 'UIO-GYE-UIO', salida: '2026-11-20T13:05:00Z', pax: 2 });
  });

  it('flattens the mobile detail and drops contact, payment, history and internal ids', () => {
    const movil = aMovil(vista, [{ codigo: 'CANCELAR', metodo: 'POST', href: '/x', requiereIdempotencia: true }]);
    expect(movil.pasajeros[0]).toEqual({ nombre: 'David Tapia', eTicket: '0451234567890', asientos: ['', '12A'], qr: 'v1.x.y.z' });
    expect(movil.pasajeros[1]).toEqual({ nombre: 'Ana Mora', eTicket: null, asientos: [] });
    expect(movil.acciones).toEqual(['CANCELAR']);
    const texto = JSON.stringify(movil);
    for (const prohibido of ['david@mail.com', '+593999999999', 'VISA', '4242', 'ordenId', 'bookingId', 'historial', 'contacto']) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it('is much smaller than the full view', () => {
    expect(JSON.stringify(aMovil(vista, [])).length).toBeLessThan(JSON.stringify(vista).length);
  });

  it('breaks the total down only when there is an invoice', () => {
    expect(importesDe({ moneda: 'USD', totalMinor: 38640 })).toEqual({ total: { moneda: 'USD', monto: '386.40' } });
    expect(importesDe({ moneda: 'USD', totalMinor: 38640, factura: { subtotalMinor: 34500, ivaMinor: 4140 } })).toEqual({
      subtotal: { moneda: 'USD', monto: '345.00' },
      impuestos: { moneda: 'USD', monto: '41.40' },
      total: { moneda: 'USD', monto: '386.40' },
    });
  });
});
