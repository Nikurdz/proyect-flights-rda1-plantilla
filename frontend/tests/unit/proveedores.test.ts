import { describe, expect, it } from 'vitest';
import type { ProveedorView, SaludView } from '../../src/api/types';
import {
  circuitoInfo,
  estaCaido,
  estadisticasLatencia,
  formatLatency,
  haceTiempo,
  puedeSincronizar,
  resumenFlota,
  resumenSincronizacion,
  semaforo,
  seriesLatencia,
  techoEje,
  tipoServicioLabel,
} from '../../src/lib/proveedores';

const prov = (over: Partial<ProveedorView> & { estado?: SaludView['estado'] } = {}): ProveedorView => {
  const { estado = 'UP', ...rest } = over;
  return {
    id: 'p1',
    nombre: 'Atracciones',
    equipo: 'Equipo',
    baseUrl: 'https://x.example.com/api/v2',
    tipoServicio: 'ATRACCIONES',
    activo: true,
    salud: { estado, latenciaMs: 120, detalle: null, comprobadoEn: '2026-10-25T10:00:00.000Z' },
    circuito: 'CERRADO',
    productos: 3,
    ...rest,
  };
};

describe('semaforo', () => {
  it('maps each health state to a tone and always to a text', () => {
    expect(semaforo('UP')).toMatchObject({ tone: 'success', label: 'En línea' });
    expect(semaforo('DEGRADADO')).toMatchObject({ tone: 'warning', label: 'Degradado' });
    expect(semaforo('DOWN')).toMatchObject({ tone: 'danger', label: 'Caído' });
    expect(semaforo('APAGADO')).toMatchObject({ tone: 'neutral', label: 'Apagado' });
    expect(semaforo('SIN_DATOS')).toMatchObject({ tone: 'neutral', label: 'Sin datos' });
  });

  it('treats an unknown or missing state as «sin datos», never as healthy', () => {
    expect(semaforo('RARO').tone).toBe('neutral');
    expect(semaforo(null).label).toBe('Sin datos');
    expect(semaforo(undefined).tone).toBe('neutral');
  });
});

describe('circuitoInfo', () => {
  it('explains the three circuit states', () => {
    expect(circuitoInfo('CERRADO').tone).toBe('success');
    expect(circuitoInfo('SEMIABIERTO').tone).toBe('warning');
    expect(circuitoInfo('ABIERTO')).toMatchObject({ tone: 'danger', label: 'Circuito abierto' });
  });
});

describe('fleet summary', () => {
  it('counts each group once and only counts open circuits of providers that are on', () => {
    const lista = [
      prov({ id: 'a', estado: 'UP' }),
      prov({ id: 'b', estado: 'DEGRADADO' }),
      prov({ id: 'c', estado: 'DOWN', circuito: 'ABIERTO' }),
      prov({ id: 'd', activo: false, estado: 'APAGADO', circuito: 'ABIERTO' }),
      prov({ id: 'e', estado: 'SIN_DATOS' }),
    ];
    expect(resumenFlota(lista)).toEqual({ total: 5, enLinea: 1, degradados: 1, caidos: 1, apagados: 1, sinDatos: 1, circuitosAbiertos: 1 });
  });

  it('«caído» means on and DOWN: a switched-off provider is not an outage', () => {
    expect(estaCaido(prov({ estado: 'DOWN' }))).toBe(true);
    expect(estaCaido(prov({ activo: false, estado: 'DOWN' }))).toBe(false);
    expect(estaCaido(prov({ estado: 'DEGRADADO' }))).toBe(false);
  });
});

describe('helpers', () => {
  it('formats latency and labels', () => {
    expect(formatLatency(null)).toBe('—');
    expect(formatLatency(87.4)).toBe('87 ms');
    expect(tipoServicioLabel('AUTOS')).toBe('Autos');
    expect(tipoServicioLabel('OTRO')).toBe('OTRO');
  });

  it('only ATRACCIONES can synchronise', () => {
    expect(puedeSincronizar('ATRACCIONES')).toBe(true);
    expect(puedeSincronizar('AUTOS')).toBe(false);
    expect(puedeSincronizar('ALOJAMIENTOS')).toBe(false);
  });

  it('summarises a synchronisation', () => {
    expect(resumenSincronizacion({ importados: 10, nuevos: 4, actualizados: 5, desactivados: 1 })).toBe('10 importados: 4 nuevos, 5 actualizados y 1 desactivados.');
  });

  it('says how long ago the last check ran', () => {
    const now = Date.parse('2026-10-25T12:00:00.000Z');
    expect(haceTiempo(null, now)).toBe('nunca');
    expect(haceTiempo('2026-10-25T11:59:50.000Z', now)).toBe('hace unos segundos');
    expect(haceTiempo('2026-10-25T11:55:00.000Z', now)).toBe('hace 5 min');
    expect(haceTiempo('2026-10-25T09:00:00.000Z', now)).toBe('hace 3 h');
    expect(haceTiempo('2026-10-23T12:00:00.000Z', now)).toBe('hace 2 d');
  });
});

describe('latency series', () => {
  const h = (t: string, ms: number | null, estado: SaludView['estado'] = 'UP'): SaludView => ({ estado, latenciaMs: ms, detalle: null, comprobadoEn: t });

  it('orders the history oldest first and drops checks that measured nothing', () => {
    const puntos = seriesLatencia([h('2026-10-25T10:02:00.000Z', 300, 'DEGRADADO'), h('2026-10-25T10:01:00.000Z', null, 'DOWN'), h('2026-10-25T10:00:00.000Z', 100)]);
    expect(puntos.map((p) => p.ms)).toEqual([100, 300]);
    expect(puntos[1].estado).toBe('DEGRADADO');
  });

  it('computes min, mean, max and the last value; null with no data', () => {
    const puntos = seriesLatencia([h('2026-10-25T10:00:00.000Z', 100), h('2026-10-25T10:01:00.000Z', 300), h('2026-10-25T10:02:00.000Z', 200)]);
    expect(estadisticasLatencia(puntos)).toEqual({ min: 100, max: 300, media: 200, ultima: 200 });
    expect(estadisticasLatencia([])).toBeNull();
  });

  it('rounds the Y axis up to a tidy number', () => {
    expect(techoEje(0)).toBe(100);
    expect(techoEje(87)).toBe(100);
    expect(techoEje(130)).toBe(200);
    expect(techoEje(230)).toBe(250);
    expect(techoEje(900)).toBe(1000);
  });
});
