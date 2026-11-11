import { accionesOrden } from './acciones';

const reglas = { cutoffHours: 3, checkInOpensHours: 48, checkInClosesHours: 1 };
const ahora = new Date('2026-11-10T12:00:00Z');
const enHoras = (h: number) => new Date(ahora.getTime() + h * 3_600_000);

describe('accionesOrden', () => {
  it('offers check-in and cancellation inside the check-in window and before the cutoff', () => {
    const acciones = accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(24)], ahora, reglas });
    expect(acciones.map((a) => a.codigo)).toEqual(['CHECKIN', 'CANCELAR']);
    expect(acciones[0].href).toBe('/api/v1/bookings/b-1/check-in');
    expect(acciones.every((a) => a.metodo === 'POST' && a.requiereIdempotencia)).toBe(true);
  });

  it('offers only cancellation while check-in has not opened', () => {
    const acciones = accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(100)], ahora, reglas });
    expect(acciones.map((a) => a.codigo)).toEqual(['CANCELAR']);
  });

  it('offers only check-in when the cutoff for changes has passed', () => {
    const acciones = accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(2)], ahora, reglas });
    expect(acciones.map((a) => a.codigo)).toEqual(['CHECKIN']);
  });

  it('offers nothing once the trip has departed or check-in has closed', () => {
    expect(accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(-1)], ahora, reglas })).toEqual([]);
    expect(accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(0.5)], ahora, reglas })).toEqual([]);
  });

  it('offers nothing for an order that is not issued or has no booking', () => {
    expect(accionesOrden({ estado: 'REEMBOLSADA', bookingId: 'b-1', salidas: [enHoras(24)], ahora, reglas })).toEqual([]);
    expect(accionesOrden({ estado: 'FALLIDA_COMPENSADA', bookingId: null, salidas: [enHoras(24)], ahora, reglas })).toEqual([]);
    expect(accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [], ahora, reglas })).toEqual([]);
  });

  it('judges the cutoff by the earliest leg', () => {
    const acciones = accionesOrden({ estado: 'EMITIDA', bookingId: 'b-1', salidas: [enHoras(100), enHoras(2)], ahora, reglas });
    expect(acciones.map((a) => a.codigo)).toEqual(['CHECKIN']);
  });
});
